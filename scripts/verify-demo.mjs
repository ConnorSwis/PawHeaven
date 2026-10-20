const apiBase = process.env.DEMO_API_BASE ?? 'http://localhost:8787/api';
const baxterId = 'b1000000-0000-0000-0000-000000000001';
const rosieId = 'b1000000-0000-0000-0000-000000000004';
const firstVisitSlotId = 'c1000000-0000-0000-0000-000000000001';
const secondVisitSlotId = 'c1000000-0000-0000-0000-000000000002';
const adminEmail = 'demo.admin@pawheaven.local';
const adminPassword = 'DemoAdmin-2026!';

const baseUrl = new URL(apiBase);
if (baseUrl.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(baseUrl.hostname)) {
  throw new Error('qa:demo only runs against a local API. Set DEMO_API_BASE to a loopback URL.');
}

function fail(message) {
  throw new Error(`Demo QA failed: ${message}`);
}

function cookieHeader(response) {
  const values = response.headers.getSetCookie?.() ?? [];
  return values.map((value) => value.split(';', 1)[0]).filter(Boolean).join('; ');
}

async function request(path, { body, cookie, method = 'GET' } = {}) {
  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers: {
      Origin: 'http://localhost:4321',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { response, body: await response.json().catch(() => null), cookie: cookieHeader(response) };
}

function expectStatus(result, expected, label) {
  if (result.response.status !== expected) fail(`${label}: expected ${expected}, received ${result.response.status}.`);
  return result.body;
}

async function login(email, password) {
  const result = await request('/auth/login', { method: 'POST', body: { email, password } });
  expectStatus(result, 200, `sign in as ${email}`);
  if (!result.cookie) fail(`sign in as ${email}: no API session cookie was returned.`);
  return result.cookie;
}

const uniqueEmail = `demo-qa-${Date.now()}@pawheaven.local`;
const qaPassword = 'DemoQa-2026!';

const publicPets = await request('/pets?tag=big-dog');
const publicPayload = expectStatus(publicPets, 200, 'big dog discovery');
if (!publicPayload.pets?.some((pet) => pet.id === baxterId) || publicPayload.pets.some((pet) => ['Pending', 'Adopted'].includes(pet.status))) {
  fail('public discovery did not return only the seeded available big-dog listing.');
}

expectStatus(await request(`/pets/${rosieId}`), 404, 'non-available pet detail is hidden');

const registration = await request('/auth/register', {
  method: 'POST',
  body: { name: 'Demo QA Applicant', email: uniqueEmail, password: qaPassword },
});
expectStatus(registration, 201, 'register local QA applicant');
if (!registration.cookie) fail('register local QA applicant: no API session cookie was returned.');
const applicantCookie = registration.cookie;

expectStatus(await request('/admin/pets', { cookie: applicantCookie }), 403, 'ordinary member is denied administrator access');
expectStatus(await request('/admin/visit-slots', { cookie: applicantCookie }), 403, 'ordinary member is denied visit schedule access');
expectStatus(await request(`/applications/pets/${baxterId}`, {
  method: 'POST', cookie: applicantCookie, body: { householdSummary: '', adoptionExperience: '', note: '' },
}), 400, 'missing application answers are rejected');

const application = await request(`/applications/pets/${baxterId}`, {
  method: 'POST',
  cookie: applicantCookie,
  body: {
    householdSummary: 'Our household has a calm routine, a fenced yard, and time for daily walks and enrichment.',
    adoptionExperience: 'We have cared for dogs before and will follow the shelter’s guidance for Baxter’s transition.',
    note: 'We can arrange a meet and greet this week.',
  },
});
const applicationPayload = expectStatus(application, 201, 'valid application submission');
if (applicationPayload.status !== 'Pending') fail('valid application did not begin in Pending status.');

expectStatus(await request(`/applications/pets/${baxterId}`, {
  method: 'POST', cookie: applicantCookie, body: {
    householdSummary: 'Our household has a calm routine, a fenced yard, and time for daily walks and enrichment.',
    adoptionExperience: 'We have cared for dogs before and will follow the shelter’s guidance for Baxter’s transition.',
    note: '',
  },
}), 409, 'duplicate application is rejected');

expectStatus(await request(`/applications/pets/${rosieId}`, {
  method: 'POST', cookie: applicantCookie, body: {
    householdSummary: 'Our household has a calm routine, a fenced yard, and time for daily walks and enrichment.',
    adoptionExperience: 'We have cared for dogs before and will follow the shelter’s guidance for a new pet.',
    note: '',
  },
}), 409, 'unavailable pet application is rejected');

const visitSlots = await request('/visit-slots', { cookie: applicantCookie });
const visitSlotsPayload = expectStatus(visitSlots, 200, 'list future visit times');
if (!visitSlotsPayload.slots?.some((slot) => slot.id === firstVisitSlotId && slot.available) || !visitSlotsPayload.slots?.some((slot) => slot.id === secondVisitSlotId && slot.available)) {
  fail('the seeded future visit times were not available to the applicant.');
}

expectStatus(await request('/appointments', {
  method: 'POST', cookie: applicantCookie, body: { slotId: firstVisitSlotId, purpose: '' },
}), 400, 'missing visit purpose is rejected');

const booking = await request('/appointments', {
  method: 'POST', cookie: applicantCookie,
  body: { slotId: firstVisitSlotId, purpose: 'We would like to meet the animals and learn about the adoption process.' },
});
const bookingPayload = expectStatus(booking, 201, 'book a future visit');
if (!bookingPayload.appointmentId) fail('booking a visit did not return an appointment confirmation.');

const bookedAppointments = await request('/appointments', { cookie: applicantCookie });
const bookedAppointmentsPayload = expectStatus(bookedAppointments, 200, 'member appointment history after booking');
if (!bookedAppointmentsPayload.appointments?.some((appointment) => appointment.id === bookingPayload.appointmentId && appointment.slotId === firstVisitSlotId && appointment.status === 'booked')
  || !bookedAppointmentsPayload.events?.some((event) => event.appointmentId === bookingPayload.appointmentId && event.eventType === 'booked')) {
  fail('booking did not create the expected account appointment and confirmation event.');
}

expectStatus(await request(`/appointments/${bookingPayload.appointmentId}`, {
  method: 'PUT', cookie: applicantCookie, body: { slotId: secondVisitSlotId },
}), 200, 'reschedule a future visit');

const rescheduledAppointments = await request('/appointments', { cookie: applicantCookie });
const rescheduledAppointmentsPayload = expectStatus(rescheduledAppointments, 200, 'member appointment history after rescheduling');
if (!rescheduledAppointmentsPayload.appointments?.some((appointment) => appointment.id === bookingPayload.appointmentId && appointment.slotId === secondVisitSlotId && appointment.status === 'booked')
  || !rescheduledAppointmentsPayload.events?.some((event) => event.appointmentId === bookingPayload.appointmentId && event.eventType === 'rescheduled')) {
  fail('rescheduling did not preserve the appointment and create a confirmation event.');
}

expectStatus(await request(`/appointments/${bookingPayload.appointmentId}/cancel`, {
  method: 'POST', cookie: applicantCookie,
}), 200, 'cancel a future visit');

const canceledAppointments = await request('/appointments', { cookie: applicantCookie });
const canceledAppointmentsPayload = expectStatus(canceledAppointments, 200, 'member appointment history after cancellation');
if (!canceledAppointmentsPayload.appointments?.some((appointment) => appointment.id === bookingPayload.appointmentId && appointment.status === 'canceled')
  || !canceledAppointmentsPayload.events?.some((event) => event.appointmentId === bookingPayload.appointmentId && event.eventType === 'canceled')) {
  fail('cancellation did not preserve history and add a confirmation event.');
}

expectStatus(await request('/applications', { cookie: 'ph_access=expired' }), 401, 'expired session is rejected');

const adminCookie = await login(adminEmail, adminPassword);
const adminSchedule = await request('/admin/visit-slots', { cookie: adminCookie });
const adminSchedulePayload = expectStatus(adminSchedule, 200, 'administrator visit schedule');
if (!adminSchedulePayload.slots?.some((slot) => slot.id === firstVisitSlotId)) fail('administrator schedule did not include the seeded visit times.');
expectStatus(await request(`/admin/visit-slots/${firstVisitSlotId}/withdraw`, { method: 'POST', cookie: adminCookie }), 200, 'withdraw an open visit time');
const review = await request(`/admin/applications/${applicationPayload.id}`, {
  method: 'PUT', cookie: adminCookie, body: { status: 'Approved' },
});
const reviewPayload = expectStatus(review, 200, 'administrator review');
if (reviewPayload.status !== 'Approved') fail('administrator review did not save the selected outcome.');

const applications = await request('/applications', { cookie: applicantCookie });
const applicationsPayload = expectStatus(applications, 200, 'applicant application list');
if (!applicationsPayload.applications?.some((item) => item.id === applicationPayload.id && item.status === 'Approved')) {
  fail('applicant cannot see the administrator-recorded outcome.');
}

expectStatus(await request('/auth/logout', { method: 'POST', cookie: applicantCookie }), 200, 'applicant logout');
expectStatus(await request('/auth/logout', { method: 'POST', cookie: adminCookie }), 200, 'administrator logout');

console.log('Demo QA passed: discovery, authorization, adoption validation and review, visit booking/reschedule/cancellation history, staff visit scheduling, session expiry, and logout.');
