// Turns an export from the listing-saver userscript into supabase/seed-dekalb.sql.
//   node scripts/build-dekalb-seed.mjs path/to/animals.json
// Local demo data only: these are another shelter's animals, shown with credit and a link back.
import { readFileSync, writeFileSync } from 'node:fs';

const manifest = [];

const input = process.argv[2];
if (!input) throw new Error('Usage: node scripts/build-dekalb-seed.mjs animals.json');
const SOURCE = 'DeKalb County Animal Services';
const rows = JSON.parse(readFileSync(input, 'utf8'));

const q = (value) => `'${String(value).replaceAll("'", "''")}'`;
const arr = (values) => (values.length ? `array[${values.map(q).join(', ')}]::text[]` : "'{}'::text[]");
const years = (age) => {
  const y = Number(age.match(/(\d+)\s*year/)?.[1] ?? 0);
  const m = Number(age.match(/(\d+)\s*month/)?.[1] ?? 0);
  return y + m / 12;
};
const photo = (url) => /^https:\/\/(g\.petango\.com\/photos|petbridge\.org\/images)\//.test(url);

const seen = new Set();
const pets = [];
for (const row of rows) {
  if (!row.animalId || seen.has(row.animalId)) continue; // skips captures that were not an animal page
  seen.add(row.animalId);
  const inFoster = /\s*[-–]\s*in foster\s*$/i.test(row.name);
  const name = row.name.replace(/\s*[-–]\s*in foster\s*$/i, '').trim();
  const species = row.species === 'Dog' ? 'Dog' : row.species === 'Cat' ? 'Cat' : /bunn|rabbit/i.test(name) ? 'Rabbit' : 'Other';
  const text = (row.description || '').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim();
  const age = years(row.age || '');
  const color = (row.color || '').split('/').map((part, index) => (index ? part.trim().toLowerCase() : part.trim())).filter(Boolean).join(' and ');
  const weight = Number(row.weight?.match(/^(\d+)\s*pounds?$/)?.[1]) || null;
  const housing = /foster/i.test(row.location || '') ? 'Foster home' : row.location ? 'Shelter' : '';
  const size = { Small: 'Small', Medium: 'Medium', Large: 'Large', 'X-Large': 'Extra large' }[row.size] ?? '';
  const intake = new Date(row.intakeDate || '');
  const tags = [
    species === 'Dog' && /large/i.test(size) ? 'big-dog' : '',
    species === 'Dog' && size === 'Small' ? 'small-dog' : '',
    age && age < 1 ? (species === 'Dog' ? 'puppy' : 'kitten') : '',
    age >= 8 ? 'senior' : '',
    inFoster || housing === 'Foster home' ? 'in-foster' : '',
    /shy|nervous|scared/i.test(text) ? 'shy' : '',
    /friendly|affection|loving|sweet|gentle/i.test(text) ? 'affectionate' : '',
    /house ?trained|potty trained/i.test(text) ? 'house-trained' : '',
    /\bkids\b/i.test(text) && !/no kids/i.test(text) ? 'good-with-kids' : '',
  ].filter(Boolean).slice(0, 8);
  const sex = ['Male', 'Female'].includes(row.sex) ? row.sex : '';
  const summary = (text || `${name} is a ${row.age ? `${row.age} old ` : ''}${sex.toLowerCase()} ${species.toLowerCase()}${color ? ` with a ${color} coat` : ''}. Come meet ${name} at the shelter, or ask about taking ${name} home.`.replace(/\s+/g, ' ')).slice(0, 1990);
  const urls = (row.imageUrls ?? []).filter(photo);
  pets.push({
    id: `md5(${q(`dekalb:${row.animalId}`)})::uuid`,
    name, species, breed: species === 'Rabbit' ? 'Rabbit' : 'Mixed breed', age: row.age || 'Unknown',
    intake: Number.isNaN(intake.valueOf()) ? '2026-10-01' : intake.toISOString().slice(0, 10),
    tags, summary, sex, size, color, weight,
    fixed: ['Yes', 'No'].includes(row.spayedNeutered) ? row.spayedNeutered : 'Unknown',
    kids: /(loves|good with|lived with|done well with|great with) kids|kids over \d/i.test(text) ? 'Yes' : 'Unknown',
    dogs: /only dog/i.test(text) ? 'No' : /dog[- ]friendly|friendly with other dogs|dog friendly|foster sibling/i.test(text) ? 'Yes' : 'Unknown',
    energy: /low energy|low[- ]key|couch potato|very low/i.test(text) ? 'Low' : /medium energy/i.test(text) ? 'Medium' : /high energy|energetic|run laps/i.test(text) ? 'High' : '',
    housing, foster: housing === 'Shelter', sourceUrl: row.pageUrl || '', sourceId: row.animalId,
    // Photos are downloaded into local Storage by `npm run db:images`; the seed points at those paths.
    image: urls[0] ? `dekalb/${row.animalId}/1.jpg` : null,
    gallery: urls.slice(1, 4).map((url, index) => `dekalb/${row.animalId}/${index + 2}.jpg`),
  });
  urls.slice(0, 4).forEach((url, index) => manifest.push({ path: `dekalb/${row.animalId}/${index + 1}.jpg`, url }));
}

// image_path (not external_image_url) so lost-pet matching can compare against these photos too.
const values = pets.map((p) => `  (${p.id}, ${q(p.name)}, ${q(p.species)}, ${q(p.breed)}, ${q(p.age)}, ${q(p.intake)}, ${arr(p.tags)}, 'Available', ${q(p.summary)}, ${p.foster}, ${q(p.sex)}, ${q(p.size)}, ${q(p.color)}, ${p.weight ?? 'null'}, ${q(p.fixed)}, ${q(p.kids)}, ${q(p.dogs)}, 'Unknown', ${q(p.energy)}, ${q(p.housing)}, ${q(SOURCE)}, ${q(p.sourceUrl)}, ${q(p.sourceId)}, ${p.image ? q(p.image) : 'null'}, ${arr(p.gallery)})`);

writeFileSync(new URL('../supabase/seed-dekalb.sql', import.meta.url), `-- Generated by scripts/build-dekalb-seed.mjs. Local demo data only.
-- These animals belong to ${SOURCE}; each record carries credit and a link back,
-- and photos are fetched from the source by npm run db:images (not committed).
insert into public.pets (id, name, species, breed, age_label, intake_date, tags, status, summary, foster_available, sex, size, color, weight_lbs, spayed_neutered, good_with_kids, good_with_dogs, good_with_cats, energy_level, housing, source_name, source_url, source_animal_id, image_path, gallery_urls)
values
${values.join(',\n')}
on conflict (id) do nothing;
`);
writeFileSync(new URL('../supabase/dekalb-images.json', import.meta.url), `${JSON.stringify(manifest, null, 1)}\n`);
console.log(`Wrote ${pets.length} animals (${rows.length - pets.length} entries skipped).`);
