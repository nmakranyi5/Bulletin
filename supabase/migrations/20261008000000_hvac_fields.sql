-- HVAC-specific structured fields. Legacy columns (profiles.certifications,
-- positions.work_style, positions.experience_level) are kept so existing rows
-- and older app builds keep working.

alter table public.profiles
  add column if not exists epa_608_types text[] not null default '{}',
  add column if not exists trade_start_year integer,
  add column if not exists trade_role text;

-- (Safe to run again: any earlier copy of these checks is replaced.)
alter table public.profiles
  drop constraint if exists profiles_epa_608_types_valid,
  drop constraint if exists profiles_trade_role_valid,
  drop constraint if exists profiles_trade_start_year_valid;

alter table public.profiles
  add constraint profiles_epa_608_types_valid
    check (epa_608_types <@ array['I','II','III']),
  add constraint profiles_trade_role_valid
    check (trade_role is null or trade_role in ('Helper','Installer','Service Tech','Lead')),
  add constraint profiles_trade_start_year_valid
    check (trade_start_year is null or trade_start_year between 1950 and 2100);

alter table public.positions
  add column if not exists epa_608_required text,
  add column if not exists schedule_type text,
  add column if not exists min_experience_years integer;

-- (Safe to run again: any earlier copy of these checks is replaced.)
alter table public.positions
  drop constraint if exists positions_epa_608_required_valid,
  drop constraint if exists positions_schedule_type_valid,
  drop constraint if exists positions_min_experience_years_valid;

alter table public.positions
  add constraint positions_epa_608_required_valid
    check (epa_608_required is null or epa_608_required in ('I','II','III')),
  add constraint positions_schedule_type_valid
    check (schedule_type is null or schedule_type in ('Standard hours','Weekend rotation','On-call / emergency')),
  add constraint positions_min_experience_years_valid
    check (min_experience_years is null or min_experience_years between 0 and 60);
