-- Phone verification: the app texts a code to confirm someone has a real phone number.
-- Other people only ever see *that* the number is verified (a badge), never the number.
alter table public.profiles
  add column if not exists phone_verified_at timestamptz;

-- Nobody can set their own verified flag. Only the sync below (which flags itself) can.
create or replace function public.protect_phone_verified()
returns trigger
language plpgsql
as $$
begin
  if coalesce(current_setting('app.phone_sync', true), '') <> 'on' then
    if tg_op = 'INSERT' then
      new.phone_verified_at := null;
    else
      new.phone_verified_at := old.phone_verified_at;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_phone_verified on public.profiles;
create trigger profiles_protect_phone_verified
  before insert or update on public.profiles
  for each row execute function public.protect_phone_verified();

-- When Supabase confirms a phone number, copy that onto the profile.
create or replace function public.sync_phone_verified()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('app.phone_sync', 'on', true);
  update public.profiles set phone_verified_at = new.phone_confirmed_at where id = new.id;
  perform set_config('app.phone_sync', 'off', true);
  return new;
end;
$$;

drop trigger if exists on_auth_user_phone_confirmed on auth.users;
create trigger on_auth_user_phone_confirmed
  after update of phone_confirmed_at on auth.users
  for each row
  when (new.phone_confirmed_at is distinct from old.phone_confirmed_at)
  execute function public.sync_phone_verified();

-- Anyone who already confirmed a number gets the badge.
do $$
begin
  perform set_config('app.phone_sync', 'on', true);
  update public.profiles p
     set phone_verified_at = u.phone_confirmed_at
    from auth.users u
   where u.id = p.id and u.phone_confirmed_at is not null;
end;
$$;
