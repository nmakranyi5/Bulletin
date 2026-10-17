-- Closing a chat now comes with a reason (a positive "deal closed" or a way of not
-- moving forward), and closed chats are archived rather than just marked closed.
alter table public.interests
  add column if not exists closed_reason text,
  add column if not exists closed_note text,
  add column if not exists closed_at timestamptz,
  add column if not exists closed_by uuid references auth.users(id) on delete set null;

alter table public.interests
  add constraint interests_closed_reason_valid
    check (closed_reason is null or closed_reason in (
      'deal_closed',
      'not_interested',
      'no_response',
      'position_filled',
      'missing_certification',
      'not_enough_experience',
      'schedule_mismatch',
      'too_far',
      'chose_another',
      'pay_mismatch',
      'wrong_work',
      'took_another_job',
      'other'
    )),
  add constraint interests_closed_note_length
    check (closed_note is null or char_length(closed_note) <= 280);

-- The only way to close a chat: records the reason and archives it in one step.
-- Either person in the chat can call it, and only while it's still active.
create or replace function public.close_chat(
  p_interest_id uuid,
  p_reason text,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_reason is null then
    raise exception 'Please choose a reason';
  end if;

  update public.interests
     set status = 'closed',
         closed_reason = p_reason,
         closed_note = nullif(btrim(coalesce(p_note, '')), ''),
         closed_at = now(),
         closed_by = auth.uid()
   where id = p_interest_id
     and status = 'accepted'
     and (from_user = auth.uid() or to_user = auth.uid());

  if not found then
    raise exception 'This chat was already closed';
  end if;
end;
$$;

revoke all on function public.close_chat(uuid, text, text) from public, anon;
grant execute on function public.close_chat(uuid, text, text) to authenticated;

-- Archived chats are read-only: nothing can be sent into a chat that isn't active.
create or replace function public.block_messages_in_closed_chats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.interests
     where id = new.interest_id and status = 'accepted'
  ) then
    raise exception 'This chat is closed';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_only_in_active_chats on public.messages;
create trigger messages_only_in_active_chats
  before insert on public.messages
  for each row execute function public.block_messages_in_closed_chats();
