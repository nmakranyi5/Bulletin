-- Edit / delete your own messages. Both are soft: the row stays so the chat can
-- show "edited" / "message deleted", but a delete scrubs the text.
alter table public.messages
  add column if not exists edited_at timestamptz,
  add column if not exists deleted_at timestamptz;

-- Only the sender can change their message, only while the chat is open
-- (accepted), and only the text/markers - never read_at or the sender.
create or replace function public.edit_message(p_message_id uuid, p_body text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_body is null or length(btrim(p_body)) = 0 then
    raise exception 'Message cannot be empty';
  end if;

  update public.messages m
     set body = btrim(p_body),
         edited_at = now()
   where m.id = p_message_id
     and m.sender_id = auth.uid()
     and m.deleted_at is null
     and exists (
       select 1 from public.interests i
        where i.id = m.interest_id and i.status = 'accepted'
     );

  if not found then
    raise exception 'Message can no longer be edited';
  end if;
end;
$$;

create or replace function public.delete_message(p_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.messages m
     set body = 'This message was deleted',
         deleted_at = now()
   where m.id = p_message_id
     and m.sender_id = auth.uid()
     and m.deleted_at is null
     and exists (
       select 1 from public.interests i
        where i.id = m.interest_id and i.status = 'accepted'
     );

  if not found then
    raise exception 'Message can no longer be deleted';
  end if;
end;
$$;

revoke all on function public.edit_message(uuid, text) from public;
revoke all on function public.delete_message(uuid) from public;
grant execute on function public.edit_message(uuid, text) to authenticated;
grant execute on function public.delete_message(uuid) to authenticated;
