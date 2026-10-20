-- Document verification. People request a check (an EPA 608 card, a contractor license, a
-- certificate of insurance); reviewers approve or reject it in the app; approved checks show
-- as badges. Evidence photos live in a private bucket and are deleted after the decision.

-- Reviewers are people who may decide requests. Set it yourself in the SQL editor:
--   update public.profiles set is_reviewer = true where username = 'someone';
alter table public.profiles add column if not exists is_reviewer boolean not null default false;

-- The app can never grant reviewer access: only the SQL editor / service role can.
create or replace function public.protect_reviewer_flag()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    if tg_op = 'INSERT' then
      new.is_reviewer := false;
    else
      new.is_reviewer := old.is_reviewer;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_reviewer on public.profiles;
create trigger profiles_protect_reviewer
  before insert or update on public.profiles
  for each row execute function public.protect_reviewer_flag();

create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('epa_608', 'contractor_license', 'insurance')),
  license_number text check (license_number is null or char_length(license_number) <= 40),
  license_state text check (license_state is null or license_state ~ '^[A-Z]{2}$'),
  evidence_paths text[] not null default '{}',
  note text check (note is null or char_length(note) <= 500),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  reviewer_id uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  reject_reason text check (reject_reason is null or char_length(reject_reason) <= 400),
  created_at timestamptz not null default now()
);

-- One request waiting per person and kind.
create unique index if not exists verification_one_pending
  on public.verification_requests (user_id, kind) where status = 'pending';

alter table public.verification_requests enable row level security;
drop policy if exists "verification: read own requests" on public.verification_requests;
create policy "verification: read own requests"
  on public.verification_requests for select to authenticated
  using (user_id = auth.uid());
-- (No insert/update policies: everything goes through the functions below.)

-- What's been approved. Anyone signed in can read it (it only says "has this badge").
create table if not exists public.user_verifications (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('epa_608', 'contractor_license', 'insurance')),
  detail text,
  verified_at timestamptz not null default now(),
  expires_at timestamptz,
  request_id uuid references public.verification_requests(id) on delete set null,
  primary key (user_id, kind)
);

alter table public.user_verifications enable row level security;
drop policy if exists "verification: badges are public" on public.user_verifications;
create policy "verification: badges are public"
  on public.user_verifications for select to authenticated
  using (true);

create or replace function public.is_reviewer()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select is_reviewer from public.profiles where id = auth.uid()), false);
$$;

-- Ask for a check.
create or replace function public.submit_verification(
  p_kind text,
  p_license_number text default null,
  p_license_state text default null,
  p_paths text[] default '{}',
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  recruiter boolean;
  new_id uuid;
  path text;
begin
  select is_recruiter into recruiter from public.profiles where id = auth.uid();
  if recruiter is null then
    raise exception 'Finish setting up your profile first';
  end if;

  if p_kind = 'epa_608' and recruiter then
    raise exception 'EPA 608 verification is for job seekers';
  elsif p_kind in ('contractor_license', 'insurance') and not recruiter then
    raise exception 'That verification is for recruiters';
  elsif p_kind not in ('epa_608', 'contractor_license', 'insurance') then
    raise exception 'Unknown verification type';
  end if;

  if array_length(p_paths, 1) > 4 then
    raise exception 'Attach at most 4 files';
  end if;
  foreach path in array coalesce(p_paths, '{}') loop
    if path not like auth.uid()::text || '/%' then
      raise exception 'Invalid file';
    end if;
  end loop;

  if p_kind in ('epa_608', 'insurance') and coalesce(array_length(p_paths, 1), 0) = 0 then
    raise exception 'Attach a photo or PDF';
  end if;
  if p_kind = 'contractor_license' and (
       coalesce(btrim(p_license_number), '') = '' or p_license_state is null) then
    raise exception 'Enter your license number and state';
  end if;

  if exists (
    select 1 from public.user_verifications v
     where v.user_id = auth.uid() and v.kind = p_kind
       and (v.expires_at is null or v.expires_at > now())
  ) then
    raise exception 'You are already verified for this';
  end if;

  begin
    insert into public.verification_requests
      (user_id, kind, license_number, license_state, evidence_paths, note)
    values
      (auth.uid(), p_kind, nullif(btrim(coalesce(p_license_number, '')), ''),
       upper(btrim(p_license_state)), coalesce(p_paths, '{}'), nullif(btrim(coalesce(p_note, '')), ''))
    returning id into new_id;
  exception when unique_violation then
    raise exception 'You already have a request waiting for review';
  end;

  return new_id;
end;
$$;

-- Reviewers: everything waiting, oldest first.
create or replace function public.list_pending_verifications()
returns table (
  id uuid,
  user_id uuid,
  kind text,
  license_number text,
  license_state text,
  evidence_paths text[],
  note text,
  created_at timestamptz,
  name text,
  username text,
  is_recruiter boolean,
  company_name text,
  location text,
  epa_608_types text[],
  trade_start_year int
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_reviewer() then
    raise exception 'Not allowed';
  end if;

  return query
    select r.id, r.user_id, r.kind, r.license_number, r.license_state, r.evidence_paths,
           r.note, r.created_at, p.name, p.username, p.is_recruiter, p.company_name,
           p.location, p.epa_608_types, p.trade_start_year
      from public.verification_requests r
      join public.profiles p on p.id = r.user_id
     where r.status = 'pending'
     order by r.created_at asc;
end;
$$;

-- Reviewers: approve or reject one request. You can't decide your own.
create or replace function public.review_verification(
  p_request_id uuid,
  p_approve boolean,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.verification_requests%rowtype;
begin
  if not public.is_reviewer() then
    raise exception 'Not allowed';
  end if;

  select * into req from public.verification_requests where id = p_request_id for update;
  if not found or req.status <> 'pending' then
    raise exception 'This request was already decided';
  end if;
  if req.user_id = auth.uid() then
    raise exception 'You can''t review your own request';
  end if;
  if not p_approve and coalesce(btrim(p_reason), '') = '' then
    raise exception 'Give a reason so they can fix it';
  end if;

  update public.verification_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         reviewer_id = auth.uid(),
         reviewed_at = now(),
         reject_reason = case when p_approve then null else left(btrim(p_reason), 400) end
   where id = req.id;

  if p_approve then
    insert into public.user_verifications (user_id, kind, detail, verified_at, expires_at, request_id)
    values (
      req.user_id, req.kind,
      case when req.kind = 'contractor_license' then req.license_state end,
      now(),
      -- Licenses and insurance lapse; an EPA 608 certification doesn't.
      case when req.kind = 'epa_608' then null else now() + interval '1 year' end,
      req.id
    )
    on conflict (user_id, kind) do update
      set detail = excluded.detail, verified_at = excluded.verified_at,
          expires_at = excluded.expires_at, request_id = excluded.request_id;
  end if;
end;
$$;

-- Badges for several people at once (current ones only).
create or replace function public.get_verifications(p_user_ids uuid[])
returns table (user_id uuid, kind text, detail text)
language sql
stable
security definer
set search_path = public
as $$
  select v.user_id, v.kind, v.detail
    from public.user_verifications v
   where v.user_id = any (p_user_ids)
     and (v.expires_at is null or v.expires_at > now());
$$;

revoke all on function public.is_reviewer() from public, anon;
revoke all on function public.submit_verification(text, text, text, text[], text) from public, anon;
revoke all on function public.list_pending_verifications() from public, anon;
revoke all on function public.review_verification(uuid, boolean, text) from public, anon;
revoke all on function public.get_verifications(uuid[]) from public, anon;
grant execute on function public.is_reviewer() to authenticated;
grant execute on function public.submit_verification(text, text, text, text[], text) to authenticated;
grant execute on function public.list_pending_verifications() to authenticated;
grant execute on function public.review_verification(uuid, boolean, text) to authenticated;
grant execute on function public.get_verifications(uuid[]) to authenticated;

-- Evidence goes in a private bucket: you can add files to your own folder, reviewers can read
-- and delete any (they delete it once a request is decided).
insert into storage.buckets (id, name, public)
values ('verification-docs', 'verification-docs', false)
on conflict (id) do update set public = false;

drop policy if exists "verification-docs: owner can upload" on storage.objects;
create policy "verification-docs: owner can upload"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'verification-docs' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "verification-docs: reviewers can read" on storage.objects;
create policy "verification-docs: reviewers can read"
  on storage.objects for select to authenticated
  using (bucket_id = 'verification-docs' and public.is_reviewer());

drop policy if exists "verification-docs: reviewers can delete" on storage.objects;
create policy "verification-docs: reviewers can delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'verification-docs' and public.is_reviewer());
