-- Chat for matches. A match is an interest row with status = 'accepted'.

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  interest_id uuid not null references public.interests(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(btrim(body)) > 0),
  created_at timestamptz not null default now()
);

create index if not exists messages_interest_created_idx
  on public.messages (interest_id, created_at);

alter table public.messages enable row level security;

grant select, insert on public.messages to authenticated;

drop policy if exists "match members read messages" on public.messages;
create policy "match members read messages" on public.messages
  for select to authenticated
  using (
    exists (
      select 1 from public.interests i
      where i.id = messages.interest_id
        and i.status = 'accepted'
        and auth.uid() in (i.from_user, i.to_user)
    )
  );

drop policy if exists "match members send messages" on public.messages;
create policy "match members send messages" on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.interests i
      where i.id = messages.interest_id
        and i.status = 'accepted'
        and auth.uid() in (i.from_user, i.to_user)
    )
  );

-- Let the recipient of an interest accept or reject it.
drop policy if exists "recipient responds to interest" on public.interests;
create policy "recipient responds to interest" on public.interests
  for update to authenticated
  using (to_user = auth.uid())
  with check (to_user = auth.uid());

-- Realtime delivery of new messages.
alter publication supabase_realtime add table public.messages;

-- Interest lifecycle: pending -> accepted | rejected; accepted -> closed.
-- Allow the 'closed' status (drops any old CHECK on status first).
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.interests'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.interests drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.interests
  add constraint interests_status_check
  check (status in ('pending', 'accepted', 'rejected', 'closed'));

grant select, insert, update, delete on public.interests to authenticated;

-- Sender can withdraw an interest that hasn't been answered (frees the slot).
drop policy if exists "sender withdraws pending interest" on public.interests;
create policy "sender withdraws pending interest" on public.interests
  for delete to authenticated
  using (from_user = auth.uid() and status = 'pending');

-- Sender can close a chat (accepted -> closed). Recipient already can via the
-- "recipient responds to interest" policy.
drop policy if exists "sender closes match" on public.interests;
create policy "sender closes match" on public.interests
  for update to authenticated
  using (from_user = auth.uid() and status = 'accepted')
  with check (from_user = auth.uid() and status = 'closed');
