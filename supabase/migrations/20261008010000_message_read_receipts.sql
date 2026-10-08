-- Read receipts: messages.read_at is set when the recipient opens the chat.
alter table public.messages
  add column if not exists read_at timestamptz;

create index if not exists messages_interest_unread_idx
  on public.messages (interest_id)
  where read_at is null;

-- Recipients mark messages read through this function rather than a broad
-- UPDATE policy, so they can never edit a message body. Only a participant of
-- the interest can call it, and only the other person's messages are touched.
create or replace function public.mark_messages_read(p_interest_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.messages m
     set read_at = now()
   where m.interest_id = p_interest_id
     and m.sender_id <> auth.uid()
     and m.read_at is null
     and exists (
       select 1 from public.interests i
        where i.id = p_interest_id
          and auth.uid() in (i.from_user, i.to_user)
     );
$$;

revoke all on function public.mark_messages_read(uuid) from public;
grant execute on function public.mark_messages_read(uuid) to authenticated;

