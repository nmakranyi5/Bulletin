-- Deleting an archived chat removes it from your own list only. The row is kept (the
-- other person still has their archive, and Discover keeps excluding them).
alter table public.interests
  add column if not exists from_chat_hidden boolean not null default false,
  add column if not exists to_chat_hidden boolean not null default false;

create or replace function public.hide_archived_chat(p_interest_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.interests
     set from_chat_hidden = from_chat_hidden or from_user = auth.uid(),
         to_chat_hidden = to_chat_hidden or to_user = auth.uid()
   where id = p_interest_id
     and status = 'closed'
     and (from_user = auth.uid() or to_user = auth.uid());

  if not found then
    raise exception 'Only archived chats can be deleted';
  end if;
end;
$$;

revoke all on function public.hide_archived_chat(uuid) from public, anon;
grant execute on function public.hide_archived_chat(uuid) to authenticated;
