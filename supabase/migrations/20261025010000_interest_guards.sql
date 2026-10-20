-- Server-side rules the app already enforces on screen, so they hold even if a screen is stale
-- (or someone talks to the API directly):
--   * you can't send an interest tied to a position that's closed
--   * you can have at most 10 interests waiting at once (MAX_INTERESTS in the app)
create or replace function public.check_new_interest()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.position_id is not null and exists (
    select 1 from public.positions p
     where p.id = new.position_id
       and (not p.active or (p.close_at is not null and p.close_at <= now()))
  ) then
    raise exception 'This position is closed';
  end if;

  if (select count(*) from public.interests i
       where i.from_user = new.from_user and i.status = 'pending') >= 10 then
    raise exception 'You have reached your limit of 10 interests. Wait for replies or take one back.';
  end if;

  return new;
end;
$$;

drop trigger if exists interests_check_new on public.interests;
create trigger interests_check_new
  before insert on public.interests
  for each row execute function public.check_new_interest();
