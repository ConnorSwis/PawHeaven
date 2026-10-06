-- Demo pets so the public directory, pet details, and staff portal have data to show.
-- These animals are fictional. Remove them before launch with:
--   delete from public.pets where summary like '%[demo]';
-- Intake dates are relative to the day this migration runs so days in shelter look realistic.
-- Tags use the slugs offered by the public site's tag filter. Biscuit is Pending, so the public
-- list shows five pets while staff see all six (enforced by the pets RLS policies).

insert into public.pets (name, species, breed, age_label, intake_date, tags, status, summary) values
  ('Biscuit', 'Dog', 'Beagle mix', '4 years', current_date - 33, array['good-with-kids', 'playful'], 'Pending',
   'Biscuit follows his nose everywhere and loves a long sniffy walk. An adoption application is under review. [demo]'),
  ('Clover', 'Rabbit', 'Holland Lop', '1 year', current_date - 12, array['calm', 'indoor'], 'Available',
   'Clover is a quiet rabbit who enjoys fresh greens and a soft spot to stretch out. Litter trained. [demo]'),
  ('Juniper', 'Cat', 'Domestic longhair', '7 years', current_date - 94, array['calm', 'indoor'], 'Available',
   'Juniper is a senior cat who likes routine, gentle brushing, and a warm lap in the evening. [demo]'),
  ('Otis', 'Dog', 'German Shepherd mix', '6 years', current_date - 121, array['big-dog', 'calm'], 'Available',
   'Otis is a steady, house-trained companion who walks well on a leash and prefers a home without cats. [demo]'),
  ('Rosie', 'Dog', 'Pit Bull Terrier mix', '2 years', current_date - 47, array['big-dog', 'good-with-kids', 'playful'], 'Available',
   'Rosie is an energetic, affectionate dog who knows sit and down and would love an active family. [demo]'),
  ('Ziggy', 'Cat', 'Domestic shorthair', '8 months', current_date - 6, array['playful', 'indoor', 'good-with-kids'], 'Available',
   'Ziggy is a curious kitten who chases wand toys and gets along with gentle children. [demo]');
