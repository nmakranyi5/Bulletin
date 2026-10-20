-- Hardening, from a review of the earlier migrations.
--
--  * People can't flip their own role (it gates resume access and which verifications they
--    can ask for) or write the columns that feed ratings and chat state on interests; only
--    accepting an interest addressed to you is allowed directly, everything else goes through
--    the functions.
--  * Overdue interests are remembered when a position closes, so reopening the position
--    can't erase the misses from a recruiter's rating.
--  * The first-message check only counts the recruiter's own message, and the rating no
--    longer disagrees with the reply timers about deleted messages.
--  * The 10-interest limit holds when several are sent at once.
--  * A position's close date can't be pushed more than a year out.

-- Role can't be changed after signup by the app (the SQL editor and functions still can).
create or replace function public.protect_is_recruiter()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.is_recruiter := old.is_recruiter;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
  before update on public.profiles
  for each row execute function public.protect_is_recruiter();

-- From the app, an interest can only be changed by its recipient accepting it. Named so it
-- runs before the trigger that stamps responded_at.
create or replace function public.guard_interest_update()
returns trigger
language plpgsql
as $$
begin
  if current_user in ('authenticated', 'anon') then
    new.responded_at := old.responded_at;
    new.declined_at := old.declined_at;
    new.decline_reason := old.decline_reason;
    new.decline_note := old.decline_note;
    new.closed_reason := old.closed_reason;
    new.closed_note := old.closed_note;
    new.closed_at := old.closed_at;
    new.closed_by := old.closed_by;
    new.sender_hidden := old.sender_hidden;
    new.from_chat_hidden := old.from_chat_hidden;
    new.to_chat_hidden := old.to_chat_hidden;
    new.from_user := old.from_user;
    new.to_user := old.to_user;
    new.position_id := old.position_id;
    new.created_at := old.created_at;

    if not (old.status = 'pending' and new.status = 'accepted' and old.to_user = auth.uid()) then
      new.status := old.status;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists interests_a_guard on public.interests;
create trigger interests_a_guard
  before update on public.interests
  for each row execute function public.guard_interest_update();

-- Replies that were already overdue when their position closed.
create table if not exists public.missed_replies (
  interest_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  due timestamptz not null
);
alter table public.missed_replies enable row level security;
-- (No policies: only the functions below read or write it.)

-- Anything already returned before this migration counts the same way.
insert into public.missed_replies (interest_id, user_id, due)
select i.id, i.to_user, i.created_at + public.response_window(p.urgency)
  from public.interests i
  join public.positions p on p.id = i.position_id
 where i.status = 'position_closed'
   and p.closed_at is not null
   and i.created_at + public.response_window(p.urgency) < p.closed_at
on conflict do nothing;

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
    returning id, urgency
  ),
  late as (
    insert into public.missed_replies (interest_id, user_id, due)
    select i.id, i.to_user, i.created_at + public.response_window(e.urgency)
      from public.interests i
      join expired e on e.id = i.position_id
     where i.status = 'pending'
       and i.created_at + public.response_window(e.urgency) < now()
    on conflict do nothing
    returning 1
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

create or replace function public.close_position(p_position_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  urg text;
begin
  update public.positions
     set active = false,
         closed_at = now()
   where id = p_position_id
     and recruiter_id = auth.uid()
     and active
  returning urgency into urg;

  if not found then
    raise exception 'This position is already closed';
  end if;

  insert into public.missed_replies (interest_id, user_id, due)
  select i.id, i.to_user, i.created_at + public.response_window(urg)
    from public.interests i
   where i.position_id = p_position_id
     and i.status = 'pending'
     and i.created_at + public.response_window(urg) < now()
  on conflict do nothing;

  update public.interests
     set status = 'position_closed'
   where position_id = p_position_id
     and status = 'pending';
end;
$$;

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
  if p_close_at > now() + interval '366 days' then
    raise exception 'Choose a date within the next year';
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

-- Same limits as before, but safe when several interests arrive at once.
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

  -- One sender at a time, so two simultaneous inserts can't both slip under the limit.
  perform pg_advisory_xact_lock(hashtext('interest-limit:' || new.from_user::text));

  if (select count(*) from public.interests i
       where i.from_user = new.from_user and i.status = 'pending') >= 10 then
    raise exception 'You have reached your limit of 10 interests. Wait for replies or take one back.';
  end if;

  return new;
end;
$$;

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
           coalesce(i.responded_at, i.declined_at) as responded
      from users u
      join public.interests i on i.to_user = u.uid
      left join public.positions p on p.id = i.position_id
     where i.status = 'pending'
        or coalesce(i.responded_at, i.declined_at) is not null
  ),
  -- Interests that were already overdue when their position closed. Recorded at that moment
  -- (see close_position), so reopening the position can't wipe the miss.
  missed as (
    select r.user_id as uid, r.due, null::timestamptz as responded
      from users u
      join public.missed_replies r on r.user_id = u.uid
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
         -- A deleted message from them is no longer something to answer; one of mine still
         -- counted as an answer. This matches how the app's reply timers read a chat.
         where m.interest_id = i.id
           and (m.deleted_at is null or m.sender_id = u.uid)
      ) s on true
     where s.sender_id <> u.uid
       and s.prev_sender is distinct from s.sender_id
       and s.deleted_at is null
  ),
  -- Recruiters should open the conversation: once a match is made, the first message is
  -- theirs to send, within the posting's reply window. (Matches made before response times
  -- were recorded have no start time and are skipped.)
  first_move_events as (
    select u.uid,
           i.responded_at + public.response_window(p.urgency) as due,
           (select min(m.created_at)
              from public.messages m
             where m.interest_id = i.id and m.sender_id = u.uid) as responded,
           i.status
      from users u
      join public.profiles pr on pr.id = u.uid and pr.is_recruiter
      join public.interests i on (i.from_user = u.uid or i.to_user = u.uid)
                              and i.responded_at is not null
                              and i.status in ('accepted', 'closed')
      left join public.positions p on p.id = i.position_id
     -- If the other person wrote first, within the window, their message is what's owed a
     -- reply (that's counted under chat_events), not a missed first move.
     where not exists (
       select 1 from public.messages m2
        where m2.interest_id = i.id
          and m2.sender_id <> u.uid
          and m2.deleted_at is null
          and m2.created_at <= i.responded_at + public.response_window(p.urgency)
     )
  ),
  events as (
    select uid, due, responded from interest_events
    union all
    select uid, due, responded from missed
    union all
    select uid, due, responded from chat_events
     where responded is not null or (status = 'accepted' and due < now())
    union all
    select uid, due, responded from first_move_events
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
