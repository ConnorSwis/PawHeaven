-- Sprint 3 use case 5 / requirement 5: foster applications.
-- Expand-only: this adds a new table and touches nothing the previously
-- deployed API reads or writes. As with adoption applications, a submission
-- never reserves a pet, approves a placement, or changes pet availability.
-- No driver's license or payment data is collected.
create table public.foster_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references auth.users(id) on delete cascade,
  applicant_name text not null check (char_length(applicant_name) between 1 and 100),
  applicant_email text not null check (char_length(applicant_email) between 3 and 254),
  applicant_phone text not null check (char_length(applicant_phone) between 7 and 30),
  applicant_address text not null check (char_length(applicant_address) between 5 and 300),
  applicant_date_of_birth date not null check (applicant_date_of_birth >= date '1900-01-01'),
  pet_id uuid not null references public.pets(id) on delete restrict,
  pet_name text not null check (char_length(pet_name) between 1 and 100),
  household_summary text not null check (char_length(household_summary) between 20 and 2000),
  foster_experience text not null check (char_length(foster_experience) between 20 and 1000),
  available_from date not null,
  available_until date not null,
  note text not null default '' check (char_length(note) <= 1000),
  status text not null default 'Pending' check (status in ('Pending', 'In review', 'Approved', 'Declined')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  constraint foster_applications_valid_window check (
    available_until >= available_from
    and available_until <= available_from + 365
  ),
  constraint foster_applications_review_state check (
    (status = 'Pending' and reviewed_at is null and reviewed_by is null)
    or (status <> 'Pending' and reviewed_at is not null)
  ),
  constraint foster_applications_one_per_pet_per_applicant unique (applicant_id, pet_id)
);

create index foster_applications_applicant_submitted_idx
  on public.foster_applications (applicant_id, submitted_at desc);
create index foster_applications_status_submitted_idx
  on public.foster_applications (status, submitted_at asc);

alter table public.foster_applications enable row level security;
revoke all on public.foster_applications from anon, authenticated;
grant usage on schema public to authenticated;
grant select, insert on public.foster_applications to authenticated;
grant update (status, reviewed_at, reviewed_by) on public.foster_applications to authenticated;

create policy "Applicants can read their own foster applications"
on public.foster_applications for select to authenticated
using ((select auth.uid()) = applicant_id);

create policy "Staff can read all foster applications"
on public.foster_applications for select to authenticated
using ((select public.is_staff()));

-- The start date may be one day in the past so an applicant in the shelter's
-- timezone is never rejected for "today" after UTC has rolled over. The API
-- checks the exact shelter-local date.
create policy "Applicants can submit for fosterable pets"
on public.foster_applications for insert to authenticated
with check (
  (select auth.uid()) = applicant_id
  and applicant_email = coalesce((select auth.jwt() ->> 'email'), '')
  and status = 'Pending'
  and reviewed_at is null
  and reviewed_by is null
  and applicant_date_of_birth <= current_date - interval '18 years'
  and available_from >= current_date - 1
  and exists (
    select 1
    from public.pets
    where pets.id = foster_applications.pet_id
      and pets.status = 'Available'
      and pets.foster_available
  )
);

create policy "Staff can record foster application outcomes"
on public.foster_applications for update to authenticated
using ((select public.is_staff()))
with check (
  (select public.is_staff())
  and status <> 'Pending'
  and reviewed_at is not null
  and reviewed_by = (select auth.uid())
);

comment on table public.foster_applications is
  'Foster interest records for pets flagged foster_available. Applications do not reserve a pet or approve placement.';
