-- Declining an interest now comes with a reason, so people aren't left guessing why.
alter table public.interests
  add column if not exists decline_reason text,
  add column if not exists decline_note text,
  add column if not exists declined_at timestamptz;

alter table public.interests
  add constraint interests_decline_reason_valid
    check (decline_reason is null or decline_reason in (
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
  add constraint interests_decline_note_length
    check (decline_note is null or char_length(decline_note) <= 280);

-- The only way to decline: records the reason and rejects the interest in one step.
-- Only the person the interest was sent to can call it, and only while it's still
-- pending. (Anyone else, or an already-answered interest, gets an error.)
create or replace function public.decline_interest(
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
     set status = 'rejected',
         decline_reason = p_reason,
         decline_note = nullif(btrim(coalesce(p_note, '')), ''),
         declined_at = now()
   where id = p_interest_id
     and to_user = auth.uid()
     and status = 'pending';

  if not found then
    raise exception 'This interest was already answered';
  end if;
end;
$$;

revoke all on function public.decline_interest(uuid, text, text) from public, anon;
grant execute on function public.decline_interest(uuid, text, text) to authenticated;
