-- Expand-only: defaulted columns so the previously deployed API keeps working.
-- Where an animal came from (when imported from another shelter's listing, with
-- credit and a link back), extra photos hosted elsewhere, and where it lives.
alter table public.pets
  add column source_name text not null default '' check (char_length(source_name) <= 100),
  add column source_url text not null default '' check (char_length(source_url) <= 500),
  add column source_animal_id text check (source_animal_id is null or char_length(source_animal_id) <= 60),
  add column external_image_url text check (external_image_url is null or char_length(external_image_url) <= 500),
  add column gallery_urls text[] not null default '{}' check (cardinality(gallery_urls) <= 10),
  add column housing text not null default '' check (housing in ('', 'Shelter', 'Foster home'));

create unique index pets_source_animal_idx on public.pets (source_name, source_animal_id) where source_animal_id is not null;

comment on column public.pets.source_name is 'Credit shown on the pet page when the record was imported from another organization.';
comment on column public.pets.external_image_url is 'Photo hosted elsewhere; used when no uploaded image_path exists.';
comment on column public.pets.housing is 'Shelter or Foster home; empty means not recorded.';

-- Lost-pet photo matching compares against animals in this shelter's own care. Records imported
-- from another organization's listing (source_name set) are shown for browsing but never matched.
create or replace function public.lost_pet_candidates(p_species text)
returns table (
  id uuid,
  name text,
  species text,
  breed text,
  age_label text,
  status text,
  image_path text,
  intake_date date
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to search for a lost pet.' using errcode = '28000';
  end if;
  if p_species not in ('Dog', 'Cat', 'Other') then
    raise exception 'Choose Dog, Cat, or Other.' using errcode = '22023';
  end if;

  return query
    select pet.id, pet.name, pet.species, pet.breed, pet.age_label, pet.status, pet.image_path, pet.intake_date
    from public.pets pet
    where pet.status <> 'Adopted'
      and pet.image_path is not null
      and pet.source_name = ''
      and (
        (p_species = 'Other' and lower(pet.species) not in ('dog', 'cat'))
        or lower(pet.species) = lower(p_species)
      )
    order by pet.intake_date desc, pet.name
    limit 30;
end;
$$;
