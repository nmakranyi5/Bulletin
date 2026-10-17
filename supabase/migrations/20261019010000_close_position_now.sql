-- Close a position by hand, any time. It behaves just like an automatic close: the
-- position leaves Discover, interests still waiting on it are returned to the people who
-- sent them, and chats that already started stay open.
create or replace function public.close_position(p_position_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.positions
     set active = false,
         closed_at = now()
   where id = p_position_id
     and recruiter_id = auth.uid()
     and active;

  if not found then
    raise exception 'This position is already closed';
  end if;

  update public.interests
     set status = 'position_closed'
   where position_id = p_position_id
     and status = 'pending';
end;
$$;

-- Reopen a position without picking a new date. A close date that has already passed is
-- cleared (it would just close the position again); a future one is kept.
create or replace function public.reopen_position(p_position_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.positions
     set active = true,
         closed_at = null,
         close_confirmed_at = null,
         close_at = case when close_at is not null and close_at <= now() then null else close_at end
   where id = p_position_id
     and recruiter_id = auth.uid()
     and not active;

  if not found then
    raise exception 'This position is already open';
  end if;
end;
$$;

revoke all on function public.close_position(uuid) from public, anon;
grant execute on function public.close_position(uuid) to authenticated;
revoke all on function public.reopen_position(uuid) from public, anon;
grant execute on function public.reopen_position(uuid) to authenticated;
