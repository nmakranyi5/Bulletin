-- Someone who signs up but leaves before finishing setup has a profile with no name. Those
-- shouldn't be shown to anyone, and no interest should be sent to or from one. (Discover
-- now skips them too; this keeps it true even from a stale screen.)
create or replace function public.check_new_interest()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.profiles p
     where p.id in (new.from_user, new.to_user)
       and not coalesce(p.onboarded, false)
  ) then
    raise exception 'That profile isn''t set up yet';
  end if;

  if new.position_id is not null and exists (
    select 1 from public.positions p
     where p.id = new.position_id
       and (not p.active or (p.close_at is not null and p.close_at <= now()))
  ) then
    raise exception 'This position is closed';
  end if;

  -- One sender at a time, so two simultaneous inserts can't both slip under the limit.
  perform pg_advisory_xact_lock(hashtext('interest-limit:' || new.from_user::text));

  if (select count(*) from public.interests i
       where i.from_user = new.from_user and i.status = 'pending') >= 10 then
    raise exception 'You have reached your limit of 10 interests. Wait for replies or take one back.';
  end if;

  return new;
end;
$$;
