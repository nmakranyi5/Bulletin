-- One row per chat with what the Messages list needs: the last message, how many are unread,
-- and when the unanswered run from the other person started. Computed in the database so it
-- stays correct however many messages there are (the app used to read only the newest 500
-- across all chats, so a very busy chat could make quieter ones look empty).
create or replace function public.conversation_summaries()
returns table (
  interest_id uuid,
  last_text text,
  last_at timestamptz,
  last_from_me boolean,
  last_read boolean,
  unread int,
  awaiting_since timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with mine as (
    select i.id as interest_id
      from public.interests i
     where i.status in ('accepted', 'closed')
       and auth.uid() in (i.from_user, i.to_user)
  ),
  last_message as (
    select distinct on (m.interest_id)
           m.interest_id,
           case when m.deleted_at is not null then 'Message deleted' else m.body end as last_text,
           m.created_at as last_at,
           (m.sender_id = auth.uid()) as last_from_me,
           (m.read_at is not null) as last_read
      from public.messages m
      join mine on mine.interest_id = m.interest_id
     order by m.interest_id, m.created_at desc
  ),
  my_last as (
    select m.interest_id, max(m.created_at) as at
      from public.messages m
      join mine on mine.interest_id = m.interest_id
     where m.sender_id = auth.uid()
     group by m.interest_id
  ),
  theirs as (
    select m.interest_id,
           count(*) filter (where m.read_at is null and m.deleted_at is null)::int as unread,
           -- The oldest live message from them since my last reply (null if answered).
           min(m.created_at) filter (
             where m.deleted_at is null and m.created_at > coalesce(ml.at, '-infinity')
           ) as awaiting_since
      from public.messages m
      join mine on mine.interest_id = m.interest_id
      left join my_last ml on ml.interest_id = m.interest_id
     where m.sender_id <> auth.uid()
     group by m.interest_id
  )
  select l.interest_id, l.last_text, l.last_at, l.last_from_me, l.last_read,
         coalesce(t.unread, 0), t.awaiting_since
    from last_message l
    left join theirs t on t.interest_id = l.interest_id;
$$;

revoke all on function public.conversation_summaries() from public, anon;
grant execute on function public.conversation_summaries() to authenticated;
