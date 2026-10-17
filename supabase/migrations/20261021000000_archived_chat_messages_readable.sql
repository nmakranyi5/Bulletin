-- Archived chats keep their history. Messages used to be readable only while the chat was
-- active; this also lets the two people in a chat read its messages after it's closed.
-- (Sending stays blocked: the messages_only_in_active_chats trigger rejects new messages.)
drop policy if exists "messages: participants can read archived chats" on public.messages;
create policy "messages: participants can read archived chats"
  on public.messages for select to authenticated
  using (
    exists (
      select 1 from public.interests i
       where i.id = messages.interest_id
         and i.status in ('accepted', 'closed')
         and (i.from_user = auth.uid() or i.to_user = auth.uid())
    )
  );
