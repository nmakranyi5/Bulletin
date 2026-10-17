-- Lets the app measure how far a phone's clock is from the server's, so reply timers
-- (whose deadlines are server timestamps) are right even when a phone's clock is off.
-- Harmless if missing: the app just falls back to the phone's own clock.
create or replace function public.server_time()
returns timestamptz
language sql
stable
as $$
  select now();
$$;

revoke all on function public.server_time() from public, anon;
grant execute on function public.server_time() to authenticated;
