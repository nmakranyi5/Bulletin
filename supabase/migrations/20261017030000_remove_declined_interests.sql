-- Lets the person who sent an interest remove it from their list once it's been declined.
--
-- This hides the interest rather than deleting it: Discover skips anyone you've already
-- sent an interest to, so deleting the row would put someone who just declined you back
-- in your deck.
alter table public.interests
  add column if not exists sender_hidden boolean not null default false;

-- Only the sender can hide it, and only after it has been declined.
create or replace function public.hide_declined_interest(p_interest_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.interests
     set sender_hidden = true
   where id = p_interest_id
     and from_user = auth.uid()
     and status = 'rejected';

  if not found then
    raise exception 'Only a declined interest you sent can be removed';
  end if;
end;
$$;

revoke all on function public.hide_declined_interest(uuid) from public, anon;
grant execute on function public.hide_declined_interest(uuid) to authenticated;
