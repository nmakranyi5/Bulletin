-- Structured pay for positions. The old free-text positions.pay_range is kept and
-- shown for postings that haven't been edited yet.
alter table public.positions
  add column if not exists pay_type text,
  add column if not exists pay_min numeric(10,2),
  add column if not exists pay_max numeric(10,2),
  add column if not exists pay_extras text[] not null default '{}';

-- (Safe to run again: any earlier copy of these checks is replaced.)
alter table public.positions
  drop constraint if exists positions_pay_type_valid,
  drop constraint if exists positions_pay_amounts_valid,
  drop constraint if exists positions_pay_has_type,
  drop constraint if exists positions_pay_extras_valid;

alter table public.positions
  add constraint positions_pay_type_valid
    check (pay_type is null or pay_type in ('Hourly','Salary')),
  add constraint positions_pay_amounts_valid
    check (
      (pay_min is null or pay_min > 0)
      and (pay_max is null or pay_max > 0)
      and (pay_min is null or pay_max is null or pay_min <= pay_max)
    ),
  add constraint positions_pay_has_type
    check ((pay_min is null and pay_max is null) or pay_type is not null),
  add constraint positions_pay_extras_valid
    check (pay_extras <@ array['Overtime','On-call pay','Commission / bonus','Take-home van','Tools provided']);
