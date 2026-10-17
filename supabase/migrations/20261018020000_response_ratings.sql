-- Response rating: everyone starts at 5.0 stars. Answering on time keeps it up (and
-- brings it back after a miss); missing a reply deadline pulls it down.
--
-- A "response" is either answering an interest someone sent you or replying to a chat
-- message. The deadline comes from the posting's urgency (urgent 2h, standard 24h,
-- flexible 72h) and matches lib/response-timers.ts. Only the last 30 responses count,
-- so a rough patch fades as you keep replying on time.
--
--   rating = 5 * (on_time + 3) / (total + 3)
--
-- The 3 is a head start of three on-time replies, so one slip early on isn't brutal.

-- When did the person answer an interest? (Accepting had no timestamp before.)
alter table public.interests
  add column if not exists responded_at timestamptz;

create or replace function public.stamp_interest_response()
returns trigger
language plpgsql
as $$
begin
  if old.status = 'pending' and new.status <> 'pending' and new.responded_at is null then
    new.responded_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists interests_stamp_response on public.interests;
create trigger interests_stamp_response
  before update on public.interests
  for each row execute function public.stamp_interest_response();

create or replace function public.response_window(p_urgency text)
returns interval
language sql
immutable
as $$
  select case p_urgency
    when 'urgent' then interval '2 hours'
    when 'flexible' then interval '72 hours'
    else interval '24 hours'
  end;
$$;

-- Ratings for several people at once (used for Discover cards and profiles).
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
