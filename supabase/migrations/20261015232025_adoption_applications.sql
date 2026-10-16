-- Phase 2 keeps an adoption application intentionally small. Contact details
-- come from the signed-in account; no identity documents, payment data, or
-- foster workflow are collected here. Submitting an application never changes
-- a pet's availability.
create table public.adoption_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_id uuid not null references auth.users(id) on delete cascade,
  applicant_name text not null check (char_length(applicant_name) between 1 and 100),
  applicant_email text not null check (char_length(applicant_email) between 3 and 254),
  pet_id uuid not null references public.pets(id) on delete restrict,
  pet_name text not null check (char_length(pet_name) between 1 and 100),
  household_summary text not null check (char_length(household_summary) between 20 and 2000),
  note text not null default '' check (char_length(note) <= 1000),
  status text not null default 'Pending' check (status in ('Pending', 'In review', 'Approved', 'Declined')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null,
  constraint adoption_applications_review_state check (
    (status = 'Pending' and reviewed_at is null and reviewed_by is null)
    or (status <> 'Pending' and reviewed_at is not null and reviewed_by is not null)
  ),
  constraint adoption_applications_one_per_pet_per_applicant unique (applicant_id, pet_id)
);

create index adoption_applications_applicant_submitted_idx
  on public.adoption_applications (applicant_id, submitted_at desc);
create index adoption_applications_status_submitted_idx
  on public.adoption_applications (status, submitted_at asc);

alter table public.adoption_applications enable row level security;
revoke all on public.adoption_applications from anon, authenticated;
grant usage on schema public to authenticated;
grant select, insert on public.adoption_applications to authenticated;
grant update (status, reviewed_at, reviewed_by) on public.adoption_applications to authenticated;

create policy "Applicants can read their own applications"
on public.adoption_applications for select to authenticated
using ((select auth.uid()) = applicant_id);

create policy "Administrators can read all applications"
on public.adoption_applications for select to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'superuser'));

create policy "Applicants can submit for available pets"
on public.adoption_applications for insert to authenticated
with check (
  (select auth.uid()) = applicant_id
  and applicant_email = coalesce((select auth.jwt() ->> 'email'), '')
  and status = 'Pending'
  and reviewed_at is null
  and reviewed_by is null
  and exists (
    select 1
    from public.pets
    where pets.id = adoption_applications.pet_id
      and pets.status = 'Available'
  )
);

create policy "Administrators can record application outcomes"
on public.adoption_applications for update to authenticated
using ((select auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'superuser'))
with check (
  (select auth.jwt() -> 'app_metadata' ->> 'role') in ('admin', 'superuser')
  and status <> 'Pending'
  and reviewed_at is not null
  and reviewed_by = (select auth.uid())
);

comment on table public.adoption_applications is
  'Minimal adoption interest records. Applications do not reserve a pet or approve placement.';
