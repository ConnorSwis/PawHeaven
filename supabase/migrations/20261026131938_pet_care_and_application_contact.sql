-- Expand-only changes: every new column has a default or is nullable and the
-- status check only gains values, so the previously deployed API keeps working
-- until the new API is released.

-- Sprint 3 requirement 2: medical history, plus the "fostered" and
-- "unavailable" states and a flag for animals that can be fostered.
-- Only status 'Available' animals are public; foster_available marks a public
-- animal that is also open to foster applications.
alter table public.pets
  add column medical_history text not null default ''
    check (char_length(medical_history) <= 4000),
  add column foster_available boolean not null default false;

alter table public.pets drop constraint pets_status_check;
alter table public.pets
  add constraint pets_status_check
  check (status in ('Available', 'Pending', 'Adopted', 'Fostered', 'Unavailable'));

comment on column public.pets.medical_history is
  'Public-facing vaccination and health summary. Never store private owner or staff notes here.';
comment on column public.pets.foster_available is
  'When true on an Available pet, signed-in members may apply to foster the animal.';

-- Sprint 3 requirement 4: contact details on the adoption application.
-- Columns are nullable so applications submitted before this change remain
-- valid; the API requires them for every new application. No driver's license
-- or payment data is collected. The database independently enforces that a
-- supplied date of birth belongs to an adult.
alter table public.adoption_applications
  add column applicant_phone text
    check (applicant_phone is null or char_length(applicant_phone) between 7 and 30),
  add column applicant_address text
    check (applicant_address is null or char_length(applicant_address) between 5 and 300),
  add column applicant_date_of_birth date
    check (applicant_date_of_birth is null or applicant_date_of_birth >= date '1900-01-01');

drop policy "Applicants can submit for available pets" on public.adoption_applications;

create policy "Applicants can submit for available pets"
on public.adoption_applications for insert to authenticated
with check (
  (select auth.uid()) = applicant_id
  and applicant_email = coalesce((select auth.jwt() ->> 'email'), '')
  and status = 'Pending'
  and reviewed_at is null
  and reviewed_by is null
  and (applicant_date_of_birth is null or applicant_date_of_birth <= current_date - interval '18 years')
  and exists (
    select 1
    from public.pets
    where pets.id = adoption_applications.pet_id
      and pets.status = 'Available'
  )
);

comment on column public.adoption_applications.applicant_phone is
  'Applicant phone number for shelter follow-up; null only on pre-Sprint-4 rows.';
comment on column public.adoption_applications.applicant_address is
  'Applicant mailing address; null only on pre-Sprint-4 rows.';
comment on column public.adoption_applications.applicant_date_of_birth is
  'Used to confirm the applicant is an adult; null only on pre-Sprint-4 rows.';
