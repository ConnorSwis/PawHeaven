-- A completed review remains part of the shelter record after the reviewing
-- staff account is deleted. The existing foreign key clears reviewed_by, so
-- the check constraint must allow that historical state.
alter table public.adoption_applications
  drop constraint adoption_applications_review_state;

alter table public.adoption_applications
  add constraint adoption_applications_review_state check (
    (status = 'Pending' and reviewed_at is null and reviewed_by is null)
    or (status <> 'Pending' and reviewed_at is not null)
  );

comment on column public.adoption_applications.reviewed_by is
  'Reviewer account when still present; null after that staff account is deleted.';
