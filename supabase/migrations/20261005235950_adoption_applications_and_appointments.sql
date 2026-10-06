-- Adoption applications and visit appointments: the next steps after browsing a pet.
-- Signed-in users submit applications and read their own applications and appointments.
-- The app has no staff roles, so the shelter reviews applications and schedules visits in the
-- Supabase dashboard, which is not limited by these row-level security policies.
-- No API routes or pages use these tables yet. Status values and fields are a draft for the team.

create table public.adoption_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references auth.users (id) on delete cascade,
  -- Deleting a pet removes its applications.
  pet_id uuid not null references public.pets (id) on delete cascade,
  status text not null default 'Submitted' check (status in ('Submitted', 'Under review', 'Approved', 'Rejected', 'Withdrawn')),
  answers jsonb not null default '{}' check (jsonb_typeof(answers) = 'object'),
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references auth.users (id) on delete set null,
  reviewed_at timestamptz,
  check ((reviewed_by is null) = (reviewed_at is null))
);

create index adoption_applications_applicant_idx on public.adoption_applications (applicant_id);
create index adoption_applications_pet_idx on public.adoption_applications (pet_id);
create index adoption_applications_reviewer_idx on public.adoption_applications (reviewed_by);
-- One open application per person per pet.
create unique index adoption_applications_open_idx on public.adoption_applications (applicant_id, pet_id)
where status in ('Submitted', 'Under review');

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.adoption_applications (id) on delete cascade,
  scheduled_at timestamptz not null,
  status text not null default 'Scheduled' check (status in ('Scheduled', 'Completed', 'Cancelled')),
  notes text check (char_length(notes) <= 2000),
  created_at timestamptz not null default now()
);

create index appointments_application_idx on public.appointments (application_id);
create index appointments_scheduled_at_idx on public.appointments (scheduled_at);

alter table public.adoption_applications enable row level security;
alter table public.appointments enable row level security;
revoke all on public.adoption_applications, public.appointments from anon, authenticated;
grant select, insert on public.adoption_applications to authenticated;
grant select on public.appointments to authenticated;

create policy "Applicants can read their applications"
on public.adoption_applications for select to authenticated
using (applicant_id = (select auth.uid()));

-- Applicants can only submit a fresh, unreviewed application for an available pet.
create policy "Applicants can submit applications"
on public.adoption_applications for insert to authenticated
with check (
  applicant_id = (select auth.uid())
  and status = 'Submitted'
  and reviewed_by is null
  and reviewed_at is null
  and exists (select 1 from public.pets where pets.id = pet_id and pets.status = 'Available')
);

create policy "Applicants can read their appointments"
on public.appointments for select to authenticated
using (exists (
  select 1 from public.adoption_applications
  where adoption_applications.id = application_id and adoption_applications.applicant_id = (select auth.uid())
));
