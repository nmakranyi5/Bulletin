-- Positions can have a hire-by / close date.
--
-- When it passes, the position closes automatically: it leaves Discover, interests that
-- were still waiting on it are returned to the people who sent them (and they're told),
-- and chats that already started stay open. Before it closes, the recruiter is reminded
-- to extend the date or confirm it.
alter table public.positions
  add column if not exists close_at timestamptz,
  add column if not exists closed_at timestamptz,
  add column if not exists close_confirmed_at timestamptz;

-- A third way an interest can end: its position closed before anyone answered.
alter table public.interests drop constraint if exists interests_status_check;
-- (Safe to run again: any earlier copy of these checks is replaced.)
alter table public.interests
  drop constraint if exists interests_status_check;

alter table public.interests
  add constraint interests_status_check
    check (status in ('pending', 'accepted', 'rejected', 'closed', 'position_closed'));

-- The closing isn't something the recruiter "answered", so it isn't stamped as a reply.
create or replace function public.stamp_interest_response()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'pending' and new.status not in ('pending', 'position_closed')
     and new.responded_at is null then
    new.responded_at := now();
  end if;
  return new;
end;
$$;

-- Senders can also clear an interest whose position closed.
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
     and status in ('rejected', 'position_closed');

  if not found then
    raise exception 'Only a declined or closed interest you sent can be removed';
  end if;
end;
$$;

-- Closes every position whose date has passed. Safe to call any time and as often as you
-- like (the app calls it as it refreshes; the schedule at the bottom does too when
-- pg_cron is available). Returns how many positions it closed.
create or replace function public.close_expired_positions()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  closed int;
begin
  with expired as (
    update public.positions
       set active = false,
           closed_at = now()
     where active
       and close_at is not null
       and close_at <= now()
    returning id
  ),
  returned as (
    update public.interests i
       set status = 'position_closed'
      from expired e
     where i.position_id = e.id
       and i.status = 'pending'
    returning i.id
  )
  select count(*) into closed from expired;

  return closed;
end;
$$;

revoke all on function public.close_expired_positions() from public, anon;
grant execute on function public.close_expired_positions() to authenticated;

-- Move the date (and reopen the position if it had already closed).
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
end;
$$;

-- "Yes, it should close on this date": stops the reminders.
create or replace function public.confirm_position_close(p_position_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.positions
     set close_confirmed_at = now()
   where id = p_position_id
     and recruiter_id = auth.uid()
     and active
     and close_at is not null;

  if not found then
    raise exception 'Position not found';
  end if;
end;
$$;

revoke all on function public.extend_position(uuid, timestamptz) from public, anon;
grant execute on function public.extend_position(uuid, timestamptz) to authenticated;
revoke all on function public.confirm_position_close(uuid) from public, anon;
grant execute on function public.confirm_position_close(uuid) to authenticated;

-- Same as before, except interests that were left unanswered until their position closed
-- only count against you when the deadline had already passed by then.
create or replace function public.get_ratings(p_user_ids uuid[])
returns table (user_id uuid, rating numeric, on_time int, late int)
language sql
stable
security definer
set search_path = public
as $$
  with users as (
    select distinct unnest(p_user_ids) as uid
  ),
  -- Interests someone sent to this person: answered, or still unanswered past the deadline.
  interest_events as (
    select u.uid,
           i.created_at + public.response_window(p.urgency) as due,
           coalesce(i.responded_at, i.declined_at) as responded,
           i.status,
           p.closed_at as position_closed_at
      from users u
      join public.interests i on i.to_user = u.uid
      left join public.positions p on p.id = i.position_id
     where i.status = 'pending'
        or coalesce(i.responded_at, i.declined_at) is not null
        -- Unanswered when the position closed: only a miss if the deadline came first.
        or (i.status = 'position_closed'
            and i.created_at + public.response_window(p.urgency) < p.closed_at)
  ),
  -- Chat messages that started a run from the other person, and this person's first reply.
  chat_events as (
    select u.uid,
           s.created_at + public.response_window(p.urgency) as due,
           (select min(r.created_at)
              from public.messages r
             where r.interest_id = s.interest_id
               and r.sender_id = u.uid
               and r.created_at > s.created_at) as responded,
           i.status
      from users u
      join public.interests i on (i.from_user = u.uid or i.to_user = u.uid)
      left join public.positions p on p.id = i.position_id
      join lateral (
        select m.*, lag(m.sender_id) over (order by m.created_at) as prev_sender
          from public.messages m
         where m.interest_id = i.id
      ) s on true
     where s.sender_id <> u.uid
       and s.prev_sender is distinct from s.sender_id
       and s.deleted_at is null
  ),
  events as (
    select uid, due, responded from interest_events
     -- A position-closed interest is never answered; it's only here if it was already late.
     where status <> 'position_closed' or responded is null
    union all
    select uid, due, responded from chat_events
     where responded is not null or (status = 'accepted' and due < now())
  ),
  ranked as (
    select uid,
           (responded is not null and responded <= due) as ok,
           row_number() over (partition by uid order by due desc) as rn
      from events
     where responded is not null or due < now()
  ),
  counts as (
    select uid,
           count(*) filter (where ok)::int as ok_count,
           count(*) filter (where not ok)::int as late_count
      from ranked
     where rn <= 30
     group by uid
  )
  select u.uid,
         round(5.0 * (coalesce(c.ok_count, 0) + 3)
               / (coalesce(c.ok_count, 0) + coalesce(c.late_count, 0) + 3), 1),
         coalesce(c.ok_count, 0),
         coalesce(c.late_count, 0)
    from users u
    left join counts c on c.uid = u.uid;
$$;

revoke all on function public.get_ratings(uuid[]) from public, anon;
grant execute on function public.get_ratings(uuid[]) to authenticated;

-- Run the closer every minute where pg_cron is installed, so positions close on time even
-- when nobody has the app open. (Without it, they close the next time anyone refreshes.)
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('close-expired-positions', '* * * * *',
                          'select public.close_expired_positions()');
  end if;
end;
$$;
