-- Role-specific profile fields. Recruiters describe their company; seekers add
-- practical details recruiters ask about. `location` is shared: a recruiter's
-- service area or a seeker's home area.
alter table public.profiles
  add column if not exists company_name text,
  add column if not exists recruiter_title text,
  add column if not exists company_size text,
  add column if not exists work_types text[] not null default '{}',
  add column if not exists company_founded_year integer,
  add column if not exists licensed_insured boolean not null default false,
  add column if not exists location text,
  add column if not exists has_drivers_license boolean not null default false,
  add column if not exists open_schedules text[] not null default '{}';

alter table public.profiles
  add constraint profiles_recruiter_title_valid
    check (recruiter_title is null or recruiter_title in ('Owner','Service manager','Hiring manager','HR / Recruiter')),
  add constraint profiles_company_size_valid
    check (company_size is null or company_size in ('1–10','11–50','51–200','200+')),
  add constraint profiles_work_types_valid
    check (work_types <@ array['Residential','Light commercial','New construction','Service & repair']),
  add constraint profiles_company_founded_year_valid
    check (company_founded_year is null or company_founded_year between 1800 and 2100),
  add constraint profiles_open_schedules_valid
    check (open_schedules <@ array['Standard hours','Weekend rotation','On-call / emergency']);
