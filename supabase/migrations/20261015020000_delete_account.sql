-- In-app account deletion. Called by the signed-in user; removes everything they
-- own, then the auth user itself. Runs as the function owner (postgres) because
-- regular users cannot delete from auth.users.
--
-- If you have other tables that reference the user, add them here (or give their
-- foreign keys ON DELETE CASCADE) before the final delete from auth.users.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;

  -- Chats: everything they sent, and every conversation they were part of.
  delete from public.messages
   where sender_id = uid
      or interest_id in (
        select id from public.interests where from_user = uid or to_user = uid
      );

  delete from public.interests where from_user = uid or to_user = uid;
  delete from public.positions where recruiter_id = uid;
  delete from public.profiles where id = uid;

  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
