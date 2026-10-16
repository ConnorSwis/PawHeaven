-- Keep applications minimal but collect a distinct, structured answer about
-- experience/preparedness. This is not a request for sensitive identity data.
alter table public.adoption_applications
  add column adoption_experience text;

-- Preserve historic applications without pretending information was supplied.
update public.adoption_applications
set adoption_experience = 'Not recorded before the structured experience field was introduced.'
where adoption_experience is null;

alter table public.adoption_applications
  alter column adoption_experience set not null,
  add constraint adoption_applications_experience_length
    check (char_length(adoption_experience) between 20 and 1000);

comment on column public.adoption_applications.adoption_experience is
  'Applicant-described pet-care experience or preparation; do not collect identity or payment data.';
