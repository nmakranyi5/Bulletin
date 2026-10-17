-- Anti-ghosting response timers.
--
-- Each posting gets an urgency level; the app turns it into a reply window
-- (urgent = 2 hours, standard = 24 hours, flexible = 3 days) and shows a timer on
-- anything waiting for a reply. Nothing is closed or blocked; timers only alert.
alter table public.positions
  add column if not exists urgency text not null default 'standard';

alter table public.positions
  add constraint positions_urgency_valid
    check (urgency in ('urgent', 'standard', 'flexible'));

-- Interest timers start when the interest was sent. This is a no-op if the column
-- already exists; on a fresh column, existing rows start their clock at migration time.
alter table public.interests
  add column if not exists created_at timestamptz not null default now();
