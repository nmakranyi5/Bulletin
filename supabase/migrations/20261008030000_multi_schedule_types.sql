-- Postings can offer several schedules, so schedule_type (single) becomes
-- schedule_types (array). The old column is kept but no longer written.
alter table public.positions
  add column if not exists schedule_types text[] not null default '{}';

update public.positions
   set schedule_types = array[schedule_type]
 where schedule_type is not null
   and schedule_types = '{}';

-- (Safe to run again: any earlier copy of these checks is replaced.)
alter table public.positions
  drop constraint if exists positions_schedule_types_valid;

alter table public.positions
  add constraint positions_schedule_types_valid
    check (schedule_types <@ array['Standard hours','Weekend rotation','On-call / emergency']);
