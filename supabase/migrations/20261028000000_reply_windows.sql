-- Agreed reply times.
--
-- Everyone sets how quickly they usually reply (1 to 5 whole days) in their profile. When two people
-- match, the chat's reply window is the midpoint of their two settings, rounded up to a whole day.
-- Urgent postings start at their 2-hour promise instead. Either person can later ask to change it
-- (urgent postings get shorter options too), and it only changes if the other person accepts. A
-- change applies to messages sent after it, never backwards. Chats made before this keep using the
-- posting's urgency window.

alter table public.profiles
  add column if not exists reply_days int not null default 2
    check (reply_days between 1 and 5);

-- The window in force for a chat, from a moment on. A chat with no entries (made before agreed
-- windows existed) falls back to the posting's urgency window.
create table if not exists public.reply_window_changes (
  interest_id uuid not null,
  effective_from timestamptz not null,
  hours int not null check (hours between 1 and 120),
  primary key (interest_id, effective_from)
);
alter table public.reply_window_changes enable row level security;
-- (No policies: read through chat_reply_windows(), written by the functions below.)

create table if not exists public.reply_window_requests (
  id uuid primary key default gen_random_uuid(),
  interest_id uuid not null,
  requested_by uuid not null references auth.users(id) on delete cascade,
  hours int not null check (hours between 1 and 120),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'expired')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '3 days',
  decided_at timestamptz
);
alter table public.reply_window_requests enable row level security;

-- One open request per chat.
create unique index if not exists reply_window_one_pending
  on public.reply_window_requests (interest_id) where status = 'pending';

-- The reply window for a chat at a given moment.
create or replace function public.chat_window(p_interest uuid, p_at timestamptz, p_urgency text)
returns interval
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select make_interval(hours => c.hours)
       from public.reply_window_changes c
      where c.interest_id = p_interest and c.effective_from <= p_at
      order by c.effective_from desc
      limit 1),
    public.response_window(p_urgency)
  );
$$;

-- Where a new match starts: urgent postings keep their 2-hour promise; everything else is the
-- midpoint of the two people's settings, rounded up to a whole day.
create or replace function public.starting_reply_hours(p_interest public.interests)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select case
    when (select pos.urgency from public.positions pos where pos.id = p_interest.position_id) = 'urgent'
      then 2
    else 24 * ceil((
      coalesce((select reply_days from public.profiles where id = p_interest.from_user), 2)
      + coalesce((select reply_days from public.profiles where id = p_interest.to_user), 2)
    ) / 2.0)::int
  end;
$$;

-- Record the starting window the moment an interest is accepted.
create or replace function public.record_starting_window()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'pending' and new.status = 'accepted' then
    insert into public.reply_window_changes (interest_id, effective_from, hours)
    values (new.id, now(), public.starting_reply_hours(new))
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists interests_record_window on public.interests;
create trigger interests_record_window
  after update on public.interests
  for each row execute function public.record_starting_window();

-- The windows for my chats (every change, oldest first).
create or replace function public.chat_reply_windows()
returns table (interest_id uuid, effective_from timestamptz, hours int)
language sql
stable
security definer
set search_path = public
as $$
  select c.interest_id, c.effective_from, c.hours
    from public.reply_window_changes c
    join public.interests i on i.id = c.interest_id
   where auth.uid() in (i.from_user, i.to_user)
   order by c.interest_id, c.effective_from;
$$;

-- Ask to change a chat's reply window.
create or replace function public.request_reply_window(p_interest_id uuid, p_hours int)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  i public.interests%rowtype;
  urg text;
  urgent boolean;
  current_hours int;
  new_id uuid;
begin
  select * into i from public.interests where id = p_interest_id;
  if not found or i.status <> 'accepted' or auth.uid() not in (i.from_user, i.to_user) then
    raise exception 'This chat is not active';
  end if;

  select pos.urgency into urg
    from public.interests x left join public.positions pos on pos.id = x.position_id
   where x.id = i.id;
  urgent := coalesce(urg = 'urgent', false);

  -- Whole days from 1 to 5; urgent postings also get shorter options.
  if not (p_hours in (24, 48, 72, 96, 120) or (urgent and p_hours in (2, 4, 12))) then
    raise exception 'That reply time is not available';
  end if;

  select extract(epoch from public.chat_window(i.id, now(), urg)) / 3600 into current_hours;
  if current_hours = p_hours then
    raise exception 'That is already the reply time';
  end if;

  update public.reply_window_requests
     set status = 'expired', decided_at = now()
   where interest_id = i.id and status = 'pending' and expires_at <= now();

  begin
    insert into public.reply_window_requests (interest_id, requested_by, hours)
    values (i.id, auth.uid(), p_hours)
    returning id into new_id;
  exception when unique_violation then
    raise exception 'There is already a request waiting for an answer';
  end;

  return new_id;
end;
$$;

-- The other person accepts or declines.
create or replace function public.respond_reply_window(p_request_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.reply_window_requests%rowtype;
  i public.interests%rowtype;
begin
  select * into r from public.reply_window_requests where id = p_request_id for update;
  if not found or r.status <> 'pending' then
    raise exception 'This request was already answered';
  end if;

  select * into i from public.interests where id = r.interest_id;
  if auth.uid() not in (i.from_user, i.to_user) or r.requested_by = auth.uid() then
    raise exception 'Only the other person can answer this';
  end if;

  if r.expires_at <= now() then
    update public.reply_window_requests set status = 'expired', decided_at = now() where id = r.id;
    raise exception 'This request has expired';
  end if;

  update public.reply_window_requests
     set status = case when p_accept then 'accepted' else 'declined' end, decided_at = now()
   where id = r.id;

  if p_accept then
    insert into public.reply_window_changes (interest_id, effective_from, hours)
    values (r.interest_id, now(), r.hours)
    on conflict (interest_id, effective_from) do update set hours = excluded.hours;
  end if;
end;
$$;

-- Requests I'm part of that still matter: ones waiting on an answer, and recent answers/expiries
-- to requests I made (so I can be told). Expired ones are marked as such here.
create or replace function public.my_reply_requests()
returns table (
  id uuid,
  interest_id uuid,
  requested_by uuid,
  hours int,
  status text,
  created_at timestamptz,
  expires_at timestamptz,
  decided_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.reply_window_requests r
     set status = 'expired', decided_at = r.expires_at
   where r.status = 'pending' and r.expires_at <= now()
     and r.interest_id in (select x.id from public.interests x where auth.uid() in (x.from_user, x.to_user));

  return query
    select r.id, r.interest_id, r.requested_by, r.hours, r.status, r.created_at, r.expires_at, r.decided_at
      from public.reply_window_requests r
      join public.interests i on i.id = r.interest_id
     where auth.uid() in (i.from_user, i.to_user)
       and (r.status = 'pending'
            or (r.requested_by = auth.uid() and r.decided_at > now() - interval '14 days'))
     order by r.created_at;
end;
$$;

revoke all on function public.chat_window(uuid, timestamptz, text) from public, anon;
revoke all on function public.chat_reply_windows() from public, anon;
revoke all on function public.request_reply_window(uuid, int) from public, anon;
revoke all on function public.respond_reply_window(uuid, boolean) from public, anon;
revoke all on function public.my_reply_requests() from public, anon;
grant execute on function public.chat_reply_windows() to authenticated;
grant execute on function public.request_reply_window(uuid, int) to authenticated;
grant execute on function public.respond_reply_window(uuid, boolean) to authenticated;
grant execute on function public.my_reply_requests() to authenticated;
grant execute on function public.chat_window(uuid, timestamptz, text) to authenticated;

-- Ratings judge each message against the window in force when it was sent.
create or replace function public.get_ratings(p_user_ids uuid[])
returns table (user_id uuid, rating numeric, on_time int, late int)
language sql
stable
security definer
set search_path = public
as $$
  with users as (
    select distinct unnest(p_user_ids) as uid
  ),
  -- Interests someone sent to this person: answered, or still unanswered past the deadline.
  interest_events as (
    select u.uid,
           i.created_at + public.response_window(p.urgency) as due,
           coalesce(i.responded_at, i.declined_at) as responded
      from users u
      join public.interests i on i.to_user = u.uid
      left join public.positions p on p.id = i.position_id
     where i.status = 'pending'
        or coalesce(i.responded_at, i.declined_at) is not null
  ),
  -- Interests that were already overdue when their position closed. Recorded at that moment
  -- (see close_position), so reopening the position can't wipe the miss.
  missed as (
    select r.user_id as uid, r.due, null::timestamptz as responded
      from users u
      join public.missed_replies r on r.user_id = u.uid
  ),
  -- Chat messages that started a run from the other person, and this person's first reply.
  chat_events as (
    select u.uid,
           s.created_at + public.chat_window(i.id, s.created_at, p.urgency) as due,
           (select min(r.created_at)
              from public.messages r
             where r.interest_id = s.interest_id
               and r.sender_id = u.uid
               and r.created_at > s.created_at) as responded,
           i.status
      from users u
      join public.interests i on (i.from_user = u.uid or i.to_user = u.uid)
      left join public.positions p on p.id = i.position_id
      join lateral (
        select m.*, lag(m.sender_id) over (order by m.created_at) as prev_sender
          from public.messages m
         -- A deleted message from them is no longer something to answer; one of mine still
         -- counted as an answer. This matches how the app's reply timers read a chat.
         where m.interest_id = i.id
           and (m.deleted_at is null or m.sender_id = u.uid)
      ) s on true
     where s.sender_id <> u.uid
       and s.prev_sender is distinct from s.sender_id
       and s.deleted_at is null
  ),
  -- Recruiters should open the conversation: once a match is made, the first message is
  -- theirs to send, within the posting's reply window. (Matches made before response times
  -- were recorded have no start time and are skipped.)
  first_move_events as (
    select u.uid,
           i.responded_at + public.chat_window(i.id, i.responded_at, p.urgency) as due,
           (select min(m.created_at)
              from public.messages m
             where m.interest_id = i.id and m.sender_id = u.uid) as responded,
           i.status
      from users u
      join public.profiles pr on pr.id = u.uid and pr.is_recruiter
      join public.interests i on (i.from_user = u.uid or i.to_user = u.uid)
                              and i.responded_at is not null
                              and i.status in ('accepted', 'closed')
      left join public.positions p on p.id = i.position_id
     -- If the other person wrote first, within the window, their message is what's owed a
     -- reply (that's counted under chat_events), not a missed first move.
     where not exists (
       select 1 from public.messages m2
        where m2.interest_id = i.id
          and m2.sender_id <> u.uid
          and m2.deleted_at is null
          and m2.created_at <= i.responded_at + public.chat_window(i.id, i.responded_at, p.urgency)
     )
  ),
  events as (
    select uid, due, responded from interest_events
    union all
    select uid, due, responded from missed
    union all
    select uid, due, responded from chat_events
     where responded is not null or (status = 'accepted' and due < now())
    union all
    select uid, due, responded from first_move_events
     where responded is not null or (status = 'accepted' and due < now())
  ),
  ranked as (
    select uid,
           (responded is not null and responded <= due) as ok,
           row_number() over (partition by uid order by due desc) as rn
      from events
     where responded is not null or due < now()
  ),
  counts as (
    select uid,
           count(*) filter (where ok)::int as ok_count,
           count(*) filter (where not ok)::int as late_count
      from ranked
     where rn <= 30
     group by uid
  )
  select u.uid,
         round(5.0 * (coalesce(c.ok_count, 0) + 3)
               / (coalesce(c.ok_count, 0) + coalesce(c.late_count, 0) + 3), 1),
         coalesce(c.ok_count, 0),
         coalesce(c.late_count, 0)
    from users u
    left join counts c on c.uid = u.uid;
$$;


revoke all on function public.get_ratings(uuid[]) from public, anon;
grant execute on function public.get_ratings(uuid[]) to authenticated;
