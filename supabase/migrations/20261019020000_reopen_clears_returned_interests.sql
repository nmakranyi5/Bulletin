-- When a closed position opens again, the interests that were returned to people when it
-- closed are cleared, so those people can show interest in it again. (Without this, the
-- old returned row would block a new interest in the same position.)
create or replace function public.extend_position(p_position_id uuid, p_close_at timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_close_at is null or p_close_at <= now() then
    raise exception 'Choose a date in the future';
  end if;

  update public.positions
     set close_at = p_close_at,
         close_confirmed_at = null,
         closed_at = null,
         active = true
   where id = p_position_id
     and recruiter_id = auth.uid();

  if not found then
    raise exception 'Position not found';
  end if;

  delete from public.interests
   where position_id = p_position_id
     and status = 'position_closed';
end;
$$;

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

  delete from public.interests
   where position_id = p_position_id
     and status = 'position_closed';
end;
$$;
