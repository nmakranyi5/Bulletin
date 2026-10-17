-- Matches now have a clock from the start: the recruiter is expected to send the first
-- message within the posting's reply window (the same one used for every other reply). This
-- counts toward their response rating like any other reply.
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
  -- Recruiters should open the conversation: once a match is made, the first message is
  -- theirs to send, within the posting's reply window. (Matches made before response times
  -- were recorded have no start time and are skipped.)
  first_move_events as (
    select u.uid,
           i.responded_at + public.response_window(p.urgency) as due,
           (select min(m.created_at) from public.messages m where m.interest_id = i.id) as responded,
           i.status
      from users u
      join public.profiles pr on pr.id = u.uid and pr.is_recruiter
      join public.interests i on (i.from_user = u.uid or i.to_user = u.uid)
                              and i.responded_at is not null
                              and i.status in ('accepted', 'closed')
      left join public.positions p on p.id = i.position_id
  ),
  events as (
    select uid, due, responded from interest_events
     -- A position-closed interest is never answered; it's only here if it was already late.
     where status <> 'position_closed' or responded is null
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
