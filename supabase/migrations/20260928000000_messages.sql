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
