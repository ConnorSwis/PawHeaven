// Creates demo members through the real API and has each one use the whole site, then lets staff
// respond, so a fresh database looks thoroughly used. Local only.
//
//   npm run demo:activity                     three new members, no AI or payments
//   npm run demo:activity -- --accounts=8     eight new members
//   npm run demo:activity -- --ai             also take the AI pet-matching quiz (uses OpenRouter credit)
//   DEMO_STRIPE_WEBHOOK_SECRET=whsec_... npm run demo:activity   also records test donations
//
// Every member registers, saves a profile, books a visit that names animals, signs up for volunteer
// shifts, applies to adopt and to foster, and sometimes reschedules or cancels. Staff then review
// applications, approved fosters opt in to alerts, and the shelter asks the pool for a foster.
// Re-run it any time to add more activity.
import { createHmac } from 'node:crypto';

const apiBase = process.env.DEMO_API_BASE ?? 'http://localhost:8787/api';
const args = Object.fromEntries(process.argv.slice(2).map((arg) => { const [key, value = 'true'] = arg.replace(/^--/, '').split('='); return [key, value]; }));
const accounts = Math.max(1, Math.min(40, Number(args.accounts ?? 3)));
const withAi = args.ai === 'true';
const webhookSecret = process.env.DEMO_STRIPE_WEBHOOK_SECRET;
const staffEmail = 'demo.staff@pawheaven.local';
const staffPassword = 'DemoStaff-2026!';
const memberPassword = 'DemoMember-2026!';

const baseUrl = new URL(apiBase);
if (baseUrl.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(baseUrl.hostname)) {
  throw new Error('demo:activity only runs against a local API. Set DEMO_API_BASE to a loopback URL.');
}

const pick = (list) => list[Math.floor(Math.random() * list.length)];
const shuffle = (list) => [...list].sort(() => Math.random() - 0.5);
const isoDay = (offset) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const FIRST = ['Avery', 'Jordan', 'Riley', 'Quinn', 'Morgan', 'Casey', 'Rowan', 'Skyler', 'Emerson', 'Harper', 'Finley', 'Sage', 'Marlow', 'Reese', 'Tatum', 'Blair'];
const LAST = ['Okafor', 'Lindqvist', 'Moreno', 'Abernathy', 'Nakamura', 'Castellano', 'Whitfield', 'Duarte', 'Hollis', 'Ramanathan', 'Bellamy', 'Ostrowski', 'Pereira', 'Calloway'];
const STREETS = ['Peachtree St NE', 'Ponce de Leon Ave', 'Edgewood Ave SE', 'Boulevard NE', 'Memorial Dr SE', 'DeKalb Ave NE', 'Moreland Ave SE', 'Highland Ave NE'];
const PURPOSES = ['Meet a dog I saw online', 'Learn about fostering', 'Meet the cats before adopting', 'Bring my kids to meet a few dogs', 'Ask about senior pets', 'Tour the shelter and meet staff'];
const HOUSEHOLDS = [
  'Two adults and a teenager in a house with a fenced yard. Someone is home most of the day.',
  'A couple in a ground-floor apartment near a park. We walk daily and work flexible hours.',
  'A family of four in a house with a large yard. The kids are eight and eleven and love animals.',
  'I live with one roommate who also wants a pet. We have a quiet routine and a small patio.',
];
const EXPERIENCE = [
  'We grew up with dogs and have had two rescues as adults. We know how to introduce a new pet slowly.',
  'I fostered cats for a local rescue for two years and am comfortable giving medication.',
  'First time adopting, but I have volunteered at a shelter and read a lot about training and enrichment.',
  'We have a senior cat at home and have raised several litters of kittens for friends and neighbors.',
];

function setCookie(response) {
  return (response.headers.getSetCookie?.() ?? []).map((value) => value.split(';', 1)[0]).filter(Boolean).join('; ');
}

async function call(path, { method = 'GET', body, cookie } = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: { Origin: 'http://localhost:4321', ...(body ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, body: payload, cookie: setCookie(response) };
}

const tally = new Map();
const note = (label, ok) => tally.set(label, [(tally.get(label)?.[0] ?? 0) + (ok ? 1 : 0), (tally.get(label)?.[1] ?? 0) + 1]);
async function step(label, run) {
  try { const result = await run(); note(label, result.ok); return result; }
  catch (error) { note(label, false); console.warn(`  ! ${label}: ${error.message}`); return { ok: false, body: null }; }
}

const health = await call('/health').catch(() => null);
if (!health?.ok) throw new Error('The local API is not running. Start it (npm run dev:api) and make sure the database is seeded.');

const pets = (await call('/pets')).body?.pets ?? [];
if (!pets.length) throw new Error('No pets are listed. Run npm run db:reset first.');
const fosterable = pets.filter((pet) => pet.fosterAvailable);

async function memberJourney(index) {
  const first = pick(FIRST);
  const last = pick(LAST);
  const email = `demo.${first}.${last}.${Date.now().toString(36)}${index}@pawheaven.local`.toLowerCase();
  const person = { name: `${first} ${last}`, email };
  const registration = await step('create account', () => call('/auth/register', { method: 'POST', body: { name: person.name, email, password: memberPassword } }));
  if (!registration.ok) return null;
  const cookie = registration.cookie;
  console.log(`• ${person.name} <${email}>`);

  const phone = `(404) 555-${String(1000 + Math.floor(Math.random() * 9000))}`;
  const dob = `${1965 + Math.floor(Math.random() * 38)}-${String(1 + Math.floor(Math.random() * 12)).padStart(2, '0')}-${String(1 + Math.floor(Math.random() * 27)).padStart(2, '0')}`;
  const address = `${100 + Math.floor(Math.random() * 900)} ${pick(STREETS)}, Atlanta, GA 303${String(Math.floor(Math.random() * 40)).padStart(2, '0')}`;
  await step('save profile', () => call('/profile', { method: 'PUT', cookie, body: { phone, address, dateOfBirth: dob } }));

  await step('browse pets', () => call('/pets?search=friendly', { cookie }));
  if (withAi) {
    const quiz = await step('take the matching quiz', () => call('/quiz', { method: 'POST', cookie, body: { livingSpace: pick(['apartment', 'small-home', 'large-yard']), household: pick(['adults', 'children']), otherPets: 'none', activityLevel: pick(['low', 'moderate', 'high']), hoursAlone: '4-8', experience: pick(['none', 'some', 'lots']), species: pick(['dog', 'cat', 'either']), size: 'any', age: 'any', traits: ['calm', 'cuddly'], notes: '' } }));
    if (!quiz.ok) console.log('  (the quiz was skipped or unavailable)');
  }

  // Visit: a future time with room, naming one to three animals.
  const slots = (await call('/visit-slots', { cookie })).body?.slots?.filter((slot) => slot.available && Date.parse(slot.startsAt) > Date.now() + 86_400_000) ?? [];
  const meetable = pets.filter((pet) => pet.status === 'Available' && pet.visitsOpen !== false);
  let booking = null;
  for (const slot of shuffle(slots).slice(0, 6)) {
    booking = await call('/appointments', { method: 'POST', cookie, body: { slotId: slot.id, purpose: pick(PURPOSES), partySize: 1 + Math.floor(Math.random() * 4), petIds: shuffle(meetable).slice(0, 1 + Math.floor(Math.random() * 3)).map((pet) => pet.id) } });
    if (booking.ok) break;
  }
  note('book a visit', Boolean(booking?.ok));
  if (booking?.ok && Math.random() < 0.4) {
    const other = shuffle(slots).find((slot) => slot.available);
    if (other) await step('reschedule a visit', () => call(`/appointments/${booking.body.appointmentId}`, { method: 'PUT', cookie, body: { slotId: other.id } }));
  } else if (booking?.ok && Math.random() < 0.2) {
    await step('cancel a visit', () => call(`/appointments/${booking.body.appointmentId}/cancel`, { method: 'POST', cookie }));
  }

  // Volunteering: a few shifts that suit this person's age and do not overlap.
  const shifts = (await call('/volunteer/shifts', { cookie })).body?.shifts ?? [];
  const taken = [];
  let signedUp = 0;
  for (const shift of shuffle(shifts.filter((item) => item.spotsRemaining > 0 && !item.registered && Date.parse(item.startsAt) > Date.now() + 86_400_000))) {
    if (signedUp >= 2 + Math.floor(Math.random() * 3)) break;
    if (taken.some((other) => Date.parse(shift.startsAt) < Date.parse(other.endsAt) && Date.parse(other.startsAt) < Date.parse(shift.endsAt))) continue;
    const result = await call(`/volunteer/shifts/${shift.id}/register`, { method: 'POST', cookie, body: { phone, dateOfBirth: dob } });
    note('sign up to volunteer', result.ok);
    if (result.ok) { signedUp += 1; taken.push(shift); }
  }
  if (signedUp && Math.random() < 0.3) {
    const mine = (await call('/volunteer/registrations', { cookie })).body?.registrations?.find((item) => item.status === 'registered');
    if (mine) await step('cancel a volunteer shift', () => call(`/volunteer/registrations/${mine.id}/cancel`, { method: 'POST', cookie }));
  }

  // Applications.
  const contact = { applicantPhone: phone, applicantAddress: address, applicantDateOfBirth: dob };
  for (const pet of shuffle(pets.filter((item) => item.status === 'Available')).slice(0, Math.random() < 0.5 ? 1 : 2)) {
    await step('apply to adopt', () => call(`/applications/pets/${pet.id}`, { method: 'POST', cookie, body: { ...contact, householdSummary: pick(HOUSEHOLDS), adoptionExperience: pick(EXPERIENCE), note: Math.random() < 0.3 ? `${pet.name} caught my eye the moment I saw the photos.` : '' } }));
  }
  if (fosterable.length && Math.random() < 0.7) {
    const pet = pick(fosterable);
    await step('apply to foster', () => call(`/foster-applications/pets/${pet.id}`, { method: 'POST', cookie, body: { ...contact, householdSummary: pick(HOUSEHOLDS), fosterExperience: pick(EXPERIENCE), availableFrom: isoDay(3 + Math.floor(Math.random() * 14)), availableUntil: isoDay(30 + Math.floor(Math.random() * 40)), note: '' } }));
  }

  if (webhookSecret && Math.random() < 0.6) {
    const sessionId = `cs_test_demo_${Date.now().toString(36)}_${index}`;
    const event = { id: `evt_${sessionId}`, type: 'checkout.session.completed', livemode: false, data: { object: { object: 'checkout.session', id: sessionId, mode: 'payment', payment_status: 'paid', amount_total: pick([1500, 2500, 5000, 10000]), currency: 'usd', payment_intent: `pi_${sessionId}`, created: Math.floor(Date.now() / 1000), customer_details: { name: person.name, email } } } };
    const body = JSON.stringify(event);
    const timestamp = Math.floor(Date.now() / 1000);
    await step('donate (test mode)', async () => {
      const response = await fetch(`${apiBase}/webhooks/stripe`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': `t=${timestamp},v1=${createHmac('sha256', webhookSecret).update(`${timestamp}.${body}`).digest('hex')}` }, body });
      return { ok: response.ok };
    });
  }
  return { ...person, cookie };
}

const members = [];
for (let index = 0; index < accounts; index += 1) {
  const member = await memberJourney(index);
  if (member) members.push(member);
}

// Staff respond: review a share of the new applications, then use the foster pool.
console.log('• Staff review');
const staff = await call('/auth/login', { method: 'POST', body: { email: staffEmail, password: staffPassword } });
if (!staff.ok) {
  console.warn('  ! Staff could not sign in; skipped reviews. Is the database seeded (npm run db:reset)?');
} else {
  const staffCookie = staff.cookie;
  const outcomes = ['In review', 'Approved', 'Approved', 'Declined'];
  const adoption = (await call('/admin/applications', { cookie: staffCookie })).body?.applications?.filter((item) => item.status === 'Pending') ?? [];
  for (const application of shuffle(adoption).slice(0, Math.ceil(adoption.length * 0.6))) {
    await step('staff review an adoption application', () => call(`/admin/applications/${application.id}`, { method: 'PUT', cookie: staffCookie, body: { status: pick(outcomes) } }));
  }
  const foster = (await call('/admin/foster-applications', { cookie: staffCookie })).body?.applications?.filter((item) => item.status === 'Pending') ?? [];
  for (const application of shuffle(foster).slice(0, Math.ceil(foster.length * 0.7))) {
    await step('staff review a foster application', () => call(`/admin/foster-applications/${application.id}`, { method: 'PUT', cookie: staffCookie, body: { status: pick(outcomes) } }));
  }

  // Approved fosters join the alert pool; staff ask the pool for help with a long-stay pet.
  for (const member of members) {
    const mine = (await call('/foster-applications', { cookie: member.cookie })).body?.applications ?? [];
    if (mine.some((item) => item.status === 'Approved')) await step('opt in to foster alerts', () => call('/me/foster-alerts', { method: 'PUT', cookie: member.cookie, body: { optIn: true } }));
  }
  const open = (await call('/admin/foster-requests', { cookie: staffCookie })).body?.requests?.filter((item) => !item.closedAt) ?? [];
  const candidates = shuffle(pets.filter((pet) => pet.status === 'Available' && !pet.fosterUrgent && pet.daysInShelter > 20));
  if (open.length < 2 && candidates.length) await step('staff ask the foster pool', () => call('/admin/foster-requests', { method: 'POST', cookie: staffCookie, body: { petId: candidates[0].id, note: 'Kennel stress is showing. A quiet home for a couple of weeks would help.' } }));
  for (const member of members) {
    const requests = (await call('/foster-requests', { cookie: member.cookie })).body?.requests?.filter((item) => item.response === 'pending') ?? [];
    if (requests[0]) await step('answer a foster request', () => call(`/foster-requests/${requests[0].id}/respond`, { method: 'POST', cookie: member.cookie, body: { accept: Math.random() < 0.5, availableFrom: isoDay(2), availableUntil: isoDay(28) } }));
  }
  await call('/auth/logout', { method: 'POST', cookie: staffCookie });
}

console.log(`\nDone. ${members.length} new member${members.length === 1 ? '' : 's'} (password for each: ${memberPassword}).`);
for (const [label, [good, total]] of tally) console.log(`  ${label.padEnd(36)} ${good}/${total}`);
