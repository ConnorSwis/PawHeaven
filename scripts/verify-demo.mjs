import { createHmac } from 'node:crypto';
import { readFileSync } from 'node:fs';

const apiBase = process.env.DEMO_API_BASE ?? 'http://localhost:8787/api';
const baxterId = 'b1000000-0000-0000-0000-000000000001';
const rosieId = 'b1000000-0000-0000-0000-000000000004';
const firstVisitSlotId = 'c1000000-0000-0000-0000-000000000001';
const secondVisitSlotId = 'c1000000-0000-0000-0000-000000000002';
const poppyId = 'b1000000-0000-0000-0000-000000000009';
const kennelShiftId = 'd1000000-0000-0000-0000-000000000001';
const dogWalkShiftId = 'd1000000-0000-0000-0000-000000000002';
const fullShiftId = 'd1000000-0000-0000-0000-000000000003';
const overlappingShiftId = 'd1000000-0000-0000-0000-000000000004';
const staffEmail = 'demo.staff@pawheaven.local';
const staffPassword = 'DemoStaff-2026!';
const superuserEmail = 'demo.superuser@pawheaven.local';
const superuserPassword = 'DemoSuperuser-2026!';

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


async function multipart(path, { fields = {}, files = [], cookie, method = 'POST' }) {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) form.append(name, value);
  for (const file of files) form.append(file.field, new Blob([file.bytes], { type: file.type }), file.name);
  const response = await fetch(`${apiBase}${path}`, { method, headers: { Origin: 'http://localhost:4321', ...(cookie ? { Cookie: cookie } : {}) }, body: form });
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

const weakRegistration = await request('/auth/register', {
  method: 'POST',
  body: { name: 'Weak Password', email: `weak-${Date.now()}@pawheaven.local`, password: 'alllowercase1' },
});
expectStatus(weakRegistration, 400, 'weak password is rejected');
if (!weakRegistration.body?.fieldErrors?.password) fail('weak password rejection did not identify the password field.');

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

const applicationDetails = {
  applicantPhone: '(404) 555-0142',
  applicantAddress: '55 Park Place NE, Atlanta, GA 30303',
  applicantDateOfBirth: '1990-04-12',
};
const minorApplication = await request(`/applications/pets/${baxterId}`, {
  method: 'POST', cookie: applicantCookie, body: {
    ...applicationDetails,
    applicantDateOfBirth: new Date(Date.now() - 16 * 365 * 86_400_000).toISOString().slice(0, 10),
    householdSummary: 'Our household has a calm routine, a fenced yard, and time for daily walks and enrichment.',
    adoptionExperience: 'We have cared for dogs before and will follow the shelter’s guidance for Baxter’s transition.',
    note: '',
  },
});
expectStatus(minorApplication, 400, 'applicants under 18 are rejected');
if (!minorApplication.body?.fieldErrors?.applicantDateOfBirth) fail('under-18 rejection did not identify the date of birth field.');
const missingContact = await request(`/applications/pets/${baxterId}`, {
  method: 'POST', cookie: applicantCookie, body: {
    householdSummary: 'Our household has a calm routine, a fenced yard, and time for daily walks and enrichment.',
    adoptionExperience: 'We have cared for dogs before and will follow the shelter’s guidance for Baxter’s transition.',
    note: '',
  },
});
expectStatus(missingContact, 400, 'missing contact details are rejected');
if (!missingContact.body?.fieldErrors?.applicantPhone || !missingContact.body.fieldErrors.applicantAddress) fail('missing contact rejection did not list each missing field.');

const application = await request(`/applications/pets/${baxterId}`, {
  method: 'POST',
  cookie: applicantCookie,
  body: {
    ...applicationDetails,
    householdSummary: 'Our household has a calm routine, a fenced yard, and time for daily walks and enrichment.',
    adoptionExperience: 'We have cared for dogs before and will follow the shelter’s guidance for Baxter’s transition.',
    note: 'We can arrange a meet and greet this week.',
  },
});
const applicationPayload = expectStatus(application, 201, 'valid application submission');
if (applicationPayload.status !== 'Pending') fail('valid application did not begin in Pending status.');
if (applicationPayload.applicantPhone !== applicationDetails.applicantPhone || applicationPayload.applicantDateOfBirth !== applicationDetails.applicantDateOfBirth) fail('the application did not retain its contact details.');

expectStatus(await request(`/applications/pets/${baxterId}`, {
  method: 'POST', cookie: applicantCookie, body: {
    ...applicationDetails,
    householdSummary: 'Our household has a calm routine, a fenced yard, and time for daily walks and enrichment.',
    adoptionExperience: 'We have cared for dogs before and will follow the shelter’s guidance for Baxter’s transition.',
    note: '',
  },
}), 409, 'duplicate application is rejected');

expectStatus(await request(`/applications/pets/${rosieId}`, {
  method: 'POST', cookie: applicantCookie, body: {
    ...applicationDetails,
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

const staffCookie = await login(staffEmail, staffPassword);
const adminSchedule = await request('/admin/visit-slots', { cookie: staffCookie });
const adminSchedulePayload = expectStatus(adminSchedule, 200, 'staff visit schedule');
if (!adminSchedulePayload.slots?.some((slot) => slot.id === firstVisitSlotId)) fail('staff schedule did not include the seeded visit times.');
expectStatus(await request(`/admin/visit-slots/${firstVisitSlotId}/withdraw`, { method: 'POST', cookie: staffCookie }), 200, 'withdraw an open visit time');
const review = await request(`/admin/applications/${applicationPayload.id}`, {
  method: 'PUT', cookie: staffCookie, body: { status: 'Approved' },
});
const reviewPayload = expectStatus(review, 200, 'staff review');
if (reviewPayload.status !== 'Approved') fail('staff review did not save the selected outcome.');

const applications = await request('/applications', { cookie: applicantCookie });
const applicationsPayload = expectStatus(applications, 200, 'applicant application list');
if (!applicationsPayload.applications?.some((item) => item.id === applicationPayload.id && item.status === 'Approved')) {
  fail('applicant cannot see the staff-recorded outcome.');
}


// Foster applications: fosterable pets only, validated availability window, staff review.
const isoDay = (offsetDays) => new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);
const fosterDetails = {
  ...applicationDetails,
  householdSummary: 'Two adults, a quiet apartment, and a flexible work-from-home schedule for a foster pet.',
  fosterExperience: 'We fostered two dogs for a local rescue last year and are comfortable with medication routines.',
  availableFrom: isoDay(7),
  availableUntil: isoDay(60),
  note: '',
};
expectStatus(await request(`/foster-applications/pets/${baxterId}`, { method: 'POST', body: fosterDetails }), 401, 'foster applications require a login');
expectStatus(await request(`/foster-applications/pets/${poppyId}`, { method: 'POST', cookie: applicantCookie, body: fosterDetails }), 409, 'a pet that is not open to foster is rejected');
expectStatus(await request(`/foster-applications/pets/${rosieId}`, { method: 'POST', cookie: applicantCookie, body: fosterDetails }), 409, 'a non-available pet cannot receive a foster application');
const emptyFoster = await request(`/foster-applications/pets/${baxterId}`, { method: 'POST', cookie: applicantCookie, body: {} });
expectStatus(emptyFoster, 400, 'missing foster answers are rejected');
for (const fieldName of ['applicantPhone', 'householdSummary', 'fosterExperience', 'availableFrom', 'availableUntil']) {
  if (!emptyFoster.body?.fieldErrors?.[fieldName]) fail(`missing foster answers did not identify the ${fieldName} field.`);
}
const pastWindow = await request(`/foster-applications/pets/${baxterId}`, { method: 'POST', cookie: applicantCookie, body: { ...fosterDetails, availableFrom: isoDay(-30) } });
expectStatus(pastWindow, 400, 'a foster window that starts in the past is rejected');
if (!pastWindow.body?.fieldErrors?.availableFrom) fail('past foster start date did not identify availableFrom.');
const backwardsWindow = await request(`/foster-applications/pets/${baxterId}`, { method: 'POST', cookie: applicantCookie, body: { ...fosterDetails, availableUntil: isoDay(3) } });
expectStatus(backwardsWindow, 400, 'a foster window that ends before it starts is rejected');
if (!backwardsWindow.body?.fieldErrors?.availableUntil) fail('backwards foster window did not identify availableUntil.');
expectStatus(await request(`/foster-applications/pets/${baxterId}`, { method: 'POST', cookie: applicantCookie, body: { ...fosterDetails, availableUntil: isoDay(500) } }), 400, 'a foster window longer than a year is rejected');
const fosterApplication = expectStatus(await request(`/foster-applications/pets/${baxterId}`, { method: 'POST', cookie: applicantCookie, body: fosterDetails }), 201, 'valid foster application');
if (fosterApplication.status !== 'Pending' || fosterApplication.availableFrom !== fosterDetails.availableFrom) fail('the foster application did not begin Pending with its availability window.');
expectStatus(await request(`/foster-applications/pets/${baxterId}`, { method: 'POST', cookie: applicantCookie, body: fosterDetails }), 409, 'duplicate foster application is rejected');
expectStatus(await request('/admin/foster-applications', { cookie: applicantCookie }), 403, 'a member cannot list foster applications');
const fosterQueue = expectStatus(await request('/admin/foster-applications', { cookie: staffCookie }), 200, 'staff foster queue');
if (!fosterQueue.applications?.some((item) => item.id === fosterApplication.id)) fail('staff did not see the submitted foster application.');
expectStatus(await request(`/admin/foster-applications/${fosterApplication.id}`, { method: 'PUT', cookie: staffCookie, body: { status: 'Pending' } }), 400, 'staff cannot move a foster application back to Pending');
expectStatus(await request(`/admin/foster-applications/${fosterApplication.id}`, { method: 'PUT', cookie: staffCookie, body: { status: 'In review' } }), 200, 'staff reviews a foster application');
const myFosterApplications = expectStatus(await request('/foster-applications', { cookie: applicantCookie }), 200, 'applicant foster application list');
if (!myFosterApplications.applications?.some((item) => item.id === fosterApplication.id && item.status === 'In review')) fail('the applicant cannot see the foster review outcome.');
const baxterAfterFoster = expectStatus(await request(`/pets/${baxterId}`), 200, 'pet stays public after a foster review');
if (baxterAfterFoster.status !== 'Available') fail('a foster review changed the pet status.');

// Volunteer shifts: capacity, minimum age, time conflicts, duplicates, cancellation, and staff management.
expectStatus(await request('/volunteer/shifts'), 401, 'volunteer shifts require a login');
const shiftList = expectStatus(await request('/volunteer/shifts', { cookie: applicantCookie }), 200, 'list volunteer shifts');
const shiftById = (id) => shiftList.shifts?.find((shift) => shift.id === id);
if (!shiftById(kennelShiftId) || shiftById(kennelShiftId).spotsRemaining !== 4 || shiftById(fullShiftId)?.spotsRemaining !== 0) fail('the seeded volunteer shifts did not report their remaining capacity.');
const fullRegistration = await request(`/volunteer/shifts/${fullShiftId}/register`, { method: 'POST', cookie: applicantCookie, body: { phone: '(404) 555-0142', dateOfBirth: '1990-04-12' } });
expectStatus(fullRegistration, 409, 'a full shift rejects registration');
if (!/full/i.test(fullRegistration.body?.message ?? '')) fail('the full-shift rejection did not explain that the shift is full.');
const minorDateOfBirth = new Date(Date.now() - 16 * 365 * 86_400_000).toISOString().slice(0, 10);
const underAge = await request(`/volunteer/shifts/${dogWalkShiftId}/register`, { method: 'POST', cookie: applicantCookie, body: { phone: '(404) 555-0142', dateOfBirth: minorDateOfBirth } });
expectStatus(underAge, 409, 'a volunteer below the minimum age is rejected');
if (!/18/.test(underAge.body?.message ?? '')) fail('the minimum-age rejection did not state the required age.');
const badVolunteerPhone = await request(`/volunteer/shifts/${kennelShiftId}/register`, { method: 'POST', cookie: applicantCookie, body: { phone: '12', dateOfBirth: '' } });
expectStatus(badVolunteerPhone, 400, 'invalid volunteer contact details are rejected');
if (!badVolunteerPhone.body?.fieldErrors?.phone || !badVolunteerPhone.body.fieldErrors.dateOfBirth) fail('invalid volunteer details did not identify each field.');
const volunteerRegistration = expectStatus(await request(`/volunteer/shifts/${kennelShiftId}/register`, { method: 'POST', cookie: applicantCookie, body: { phone: '(404) 555-0142', dateOfBirth: '1990-04-12' } }), 201, 'register for a volunteer shift');
expectStatus(await request(`/volunteer/shifts/${kennelShiftId}/register`, { method: 'POST', cookie: applicantCookie, body: { phone: '(404) 555-0142', dateOfBirth: '1990-04-12' } }), 409, 'duplicate volunteer registration is rejected');
const conflicting = await request(`/volunteer/shifts/${overlappingShiftId}/register`, { method: 'POST', cookie: applicantCookie, body: { phone: '(404) 555-0142', dateOfBirth: '1990-04-12' } });
expectStatus(conflicting, 409, 'an overlapping volunteer shift is rejected');
if (!/overlap/i.test(conflicting.body?.message ?? '')) fail('the time-conflict rejection did not explain the overlap.');
const afterRegistration = expectStatus(await request('/volunteer/shifts', { cookie: applicantCookie }), 200, 'volunteer shifts after registering');
const kennelAfter = afterRegistration.shifts.find((shift) => shift.id === kennelShiftId);
if (!kennelAfter?.registered || kennelAfter.spotsRemaining !== 3) fail('registering did not update the shift capacity and registered flag.');
const myRegistrations = expectStatus(await request('/volunteer/registrations', { cookie: applicantCookie }), 200, 'member volunteer registrations');
if (!myRegistrations.registrations?.some((item) => item.id === volunteerRegistration.registrationId && item.status === 'registered')) fail('the member registration list is missing the new registration.');

expectStatus(await request('/admin/volunteer-shifts', { cookie: applicantCookie }), 403, 'a member cannot view the volunteer roster');
const volunteerRoster = expectStatus(await request('/admin/volunteer-shifts', { cookie: staffCookie }), 200, 'staff volunteer roster');
const rosterKennel = volunteerRoster.shifts?.find((shift) => shift.id === kennelShiftId);
if (!rosterKennel?.participants?.some((participant) => participant.memberEmail === uniqueEmail)) fail('staff did not see the volunteer on the shift participant list.');
const invalidShift = await request('/admin/volunteer-shifts', { method: 'POST', cookie: staffCookie, body: { title: '', description: '', requirements: '', minAge: -1, capacity: 0, startsAt: '2001-01-01T00:00:00.000Z', endsAt: '2001-01-01T01:00:00.000Z' } });
expectStatus(invalidShift, 400, 'an invalid volunteer shift is rejected');
for (const fieldName of ['title', 'description', 'minAge', 'capacity', 'startsAt']) {
  if (!invalidShift.body?.fieldErrors?.[fieldName]) fail(`invalid volunteer shift rejection did not identify the ${fieldName} field.`);
}
const shiftStart = new Date(Date.now() + 20 * 86_400_000);
const newShift = expectStatus(await request('/admin/volunteer-shifts', {
  method: 'POST', cookie: staffCookie,
  body: { title: 'QA cleanup', description: 'Temporary QA shift.', requirements: '', minAge: 0, capacity: 2, startsAt: shiftStart.toISOString(), endsAt: new Date(shiftStart.getTime() + 2 * 3_600_000).toISOString() },
}), 201, 'staff publishes a volunteer shift');
if (!newShift.id) fail('publishing a volunteer shift did not return its id.');
expectStatus(await request(`/admin/volunteer-shifts/${kennelShiftId}`, {
  method: 'PUT', cookie: staffCookie,
  body: { title: rosterKennel.title, description: rosterKennel.description, requirements: rosterKennel.requirements, minAge: rosterKennel.minAge, capacity: 5, startsAt: new Date(Date.parse(rosterKennel.startsAt) + 3_600_000).toISOString(), endsAt: new Date(Date.parse(rosterKennel.endsAt) + 3_600_000).toISOString() },
}), 409, 'the time of a shift with volunteers cannot change');
expectStatus(await request(`/admin/volunteer-shifts/${kennelShiftId}`, {
  method: 'PUT', cookie: staffCookie,
  body: { title: rosterKennel.title, description: rosterKennel.description, requirements: rosterKennel.requirements, minAge: rosterKennel.minAge, capacity: 5, startsAt: new Date(rosterKennel.startsAt).toISOString(), endsAt: new Date(rosterKennel.endsAt).toISOString() },
}), 200, 'staff raises shift capacity');
expectStatus(await request(`/admin/volunteer-shifts/${newShift.id}/cancel`, { method: 'POST', cookie: staffCookie }), 200, 'staff cancels an empty shift');

expectStatus(await request(`/volunteer/registrations/${volunteerRegistration.registrationId}/cancel`, { method: 'POST', cookie: applicantCookie }), 200, 'member cancels a volunteer registration');
expectStatus(await request(`/volunteer/registrations/${volunteerRegistration.registrationId}/cancel`, { method: 'POST', cookie: applicantCookie }), 409, 'canceling twice is rejected');
const afterCancel = expectStatus(await request('/volunteer/shifts', { cookie: applicantCookie }), 200, 'volunteer shifts after canceling');
if (afterCancel.shifts.find((shift) => shift.id === kennelShiftId)?.spotsRemaining !== 5) fail('canceling did not free the volunteer spot.');
expectStatus(await request(`/volunteer/shifts/${kennelShiftId}/register`, { method: 'POST', cookie: applicantCookie, body: { phone: '(404) 555-0142', dateOfBirth: '1990-04-12' } }), 201, 'register again after canceling');
const canceledShift = expectStatus(await request(`/admin/volunteer-shifts/${kennelShiftId}/cancel`, { method: 'POST', cookie: staffCookie }), 200, 'staff cancels a shift with volunteers');
if (canceledShift.notified !== 1) fail('canceling a shift did not report notifying its volunteer.');
const afterShiftCancel = expectStatus(await request('/volunteer/registrations', { cookie: applicantCookie }), 200, 'registrations after the shift was canceled');
if (!afterShiftCancel.registrations?.some((item) => item.shiftId === kennelShiftId && item.status === 'canceled' && item.canceledReason === 'shift_canceled')) fail('the volunteer was not told the shelter canceled the shift.');
if (expectStatus(await request('/volunteer/shifts', { cookie: applicantCookie }), 200, 'shifts after cancellation').shifts.some((shift) => shift.id === kennelShiftId)) fail('a canceled shift is still listed for volunteers.');
expectStatus(await request(`/volunteer/shifts/${kennelShiftId}/register`, { method: 'POST', cookie: applicantCookie, body: { phone: '(404) 555-0142', dateOfBirth: '1990-04-12' } }), 409, 'a canceled shift rejects registration');


// AI quiz and lost-pet matching. Validation, authorization, limits, and inquiry rules run without a model;
// the live model checks run only when the local API has an OpenRouter key.
const quizAnswers = { livingSpace: 'apartment', household: 'adults', otherPets: 'none', activityLevel: 'low', hoursAlone: '4-8', experience: 'first-time', species: 'dog', size: 'any', age: 'any', traits: ['calm', 'cuddly'], notes: 'I work from home.' };
expectStatus(await request('/quiz', { method: 'POST', body: quizAnswers }), 401, 'the quiz requires a login');
expectStatus(await request('/quiz/latest'), 401, 'quiz results require a login');
const emptyQuiz = await request('/quiz', { method: 'POST', cookie: applicantCookie, body: {} });
expectStatus(emptyQuiz, 400, 'unanswered quiz questions are rejected');
for (const fieldName of ['livingSpace', 'activityLevel', 'experience', 'species', 'traits']) {
  if (!emptyQuiz.body?.fieldErrors?.[fieldName]) fail(`the quiz rejection did not identify the ${fieldName} question.`);
}
const manyTraits = await request('/quiz', { method: 'POST', cookie: applicantCookie, body: { ...quizAnswers, traits: ['calm', 'playful', 'cuddly', 'active'] } });
expectStatus(manyTraits, 400, 'more than three quiz traits are rejected');
if (!manyTraits.body?.fieldErrors?.traits) fail('too many traits did not identify the traits question.');
expectStatus(await request('/quiz', { method: 'POST', cookie: applicantCookie, body: { ...quizAnswers, size: 'giant' } }), 400, 'an unknown quiz answer is rejected');
const noQuizYet = expectStatus(await request('/quiz/latest', { cookie: applicantCookie }), 200, 'latest quiz before taking it');
if (noQuizYet.result !== null) fail('a new member should not have a saved quiz result.');

const baxterPhoto = readFileSync(new URL('../assets/demo-pets/baxter.jpg', import.meta.url));
const photoFile = (name = 'baxter.jpg') => ({ field: 'photos', bytes: baxterPhoto, type: 'image/jpeg', name });
expectStatus(await multipart('/lost-pet/searches', { fields: { species: 'Dog' }, files: [photoFile()] }), 401, 'lost-pet search requires a login');
const noPhoto = await multipart('/lost-pet/searches', { cookie: applicantCookie, fields: { species: 'Dog' } });
expectStatus(noPhoto, 400, 'a search without photos is rejected');
if (!noPhoto.body?.fieldErrors?.photos) fail('the missing-photo rejection did not identify the photos field.');
const wrongSpecies = await multipart('/lost-pet/searches', { cookie: applicantCookie, fields: { species: 'Dragon' }, files: [photoFile()] });
expectStatus(wrongSpecies, 400, 'an unknown species is rejected');
if (!wrongSpecies.body?.fieldErrors?.species) fail('the species rejection did not identify the species field.');
const disguised = await multipart('/lost-pet/searches', { cookie: applicantCookie, fields: { species: 'Dog' }, files: [{ field: 'photos', bytes: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), type: 'image/png', name: 'fake.png' }] });
expectStatus(disguised, 400, 'a file that is not really an image is rejected');
const gifUpload = await multipart('/lost-pet/searches', { cookie: applicantCookie, fields: { species: 'Dog' }, files: [{ field: 'photos', bytes: Buffer.from('GIF89a'), type: 'image/gif', name: 'pet.gif' }] });
expectStatus(gifUpload, 400, 'an unsupported image type is rejected');
const tooMany = await multipart('/lost-pet/searches', { cookie: applicantCookie, fields: { species: 'Dog' }, files: [photoFile('1.jpg'), photoFile('2.jpg'), photoFile('3.jpg'), photoFile('4.jpg')] });
expectStatus(tooMany, 400, 'more than three photos are rejected');
const oversize = await multipart('/lost-pet/searches', { cookie: applicantCookie, fields: { species: 'Dog' }, files: [{ field: 'photos', bytes: Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(5 * 1024 * 1024)]), type: 'image/jpeg', name: 'big.jpg' }] });
expectStatus(oversize, 400, 'a photo over 5 MB is rejected');

expectStatus(await request('/lost-pet/inquiries', { method: 'POST', cookie: applicantCookie, body: {} }), 400, 'an empty lost-pet inquiry is rejected');
const orphanInquiry = await request('/lost-pet/inquiries', { method: 'POST', cookie: applicantCookie, body: { searchId: baxterId, petId: baxterId, phone: '(404) 555-0142', message: 'This search does not belong to me or exist.' } });
expectStatus(orphanInquiry, 409, 'an inquiry for a search that does not exist is rejected');
const noInquiries = expectStatus(await request('/lost-pet/inquiries', { cookie: applicantCookie }), 200, 'member lost-pet inquiries');
if (noInquiries.inquiries?.length !== 0) fail('a new member should have no lost-pet inquiries.');
expectStatus(await request('/admin/lost-pet-inquiries', { cookie: applicantCookie }), 403, 'a member cannot read lost-pet inquiries');
expectStatus(await request('/admin/lost-pet/purge-expired', { method: 'POST', cookie: applicantCookie }), 403, 'a member cannot purge lost-pet data');
expectStatus(await request('/admin/lost-pet-inquiries', { cookie: staffCookie }), 200, 'staff lost-pet inquiry list');
expectStatus(await request('/admin/lost-pet/purge-expired', { method: 'POST', cookie: staffCookie }), 200, 'staff can purge expired lost-pet data');

// With no cat photos in the shelter there is nothing to compare, so no model is called; the daily limit still counts each attempt.
const limitUser = await request('/auth/register', { method: 'POST', body: { name: 'Limit Tester', email: `limit-${Date.now()}@pawheaven.local`, password: qaPassword } });
expectStatus(limitUser, 201, 'register a disposable limit tester');
for (let attempt = 1; attempt <= 5; attempt += 1) {
  const result = await multipart('/lost-pet/searches', { cookie: limitUser.cookie, fields: { species: 'Cat' }, files: [photoFile()] });
  expectStatus(result, 200, `lost-pet search ${attempt} with nothing to compare`);
  if (result.body?.searchId !== null || result.body?.matches?.length !== 0 || !result.body?.notice) fail('a search with nothing to compare should return a notice and keep nothing.');
}
expectStatus(await multipart('/lost-pet/searches', { cookie: limitUser.cookie, fields: { species: 'Cat' }, files: [photoFile()] }), 429, 'the daily lost-pet search limit applies');

let quiz = await request('/quiz', { method: 'POST', cookie: applicantCookie, body: quizAnswers });
// The model provider occasionally returns an unusable answer (the API reports a retryable 502); try again a couple of times.
for (let attempt = 1; attempt < 3 && quiz.response.status === 502; attempt += 1) quiz = await request('/quiz', { method: 'POST', cookie: applicantCookie, body: quizAnswers });
const aiLive = quiz.response.status !== 503;
if (!aiLive) {
  console.log('AI matching is not configured on this local API (no OPENROUTER_API_KEY in apps/api/.dev.vars): skipped the live quiz and photo-match checks.');
} else {
  const quizResult = expectStatus(quiz, 201, 'live pet-matching quiz');
  if (!Array.isArray(quizResult.recommendations) || quizResult.recommendations.some((item) => item.pet?.status !== 'Available' || item.pet?.type?.toLowerCase() !== 'dog' || !item.reason || item.score < 40 || item.score > 100)) {
    fail('the quiz returned recommendations that are not available dogs with a reason and a score.');
  }
  const latestQuiz = expectStatus(await request('/quiz/latest', { cookie: applicantCookie }), 200, 'latest quiz after taking it');
  if (latestQuiz.result?.answers?.livingSpace !== 'apartment') fail('the quiz did not save the member answers.');

  // Give Baxter a shelter photo, then search with that same photo: it must be the top possible match.
  expectStatus(await multipart(`/admin/pets/${baxterId}/image`, { cookie: staffCookie, files: [{ field: 'image', bytes: baxterPhoto, type: 'image/jpeg', name: 'baxter.jpg' }] }), 200, 'staff uploads a shelter photo');
  const search = await multipart('/lost-pet/searches', { cookie: applicantCookie, fields: { species: 'Dog', description: 'Large black, white, and tan dog' }, files: [photoFile()] });
  const searchResult = expectStatus(search, 200, 'live lost-pet photo search');
  const bestMatch = searchResult.matches?.[0];
  if (!searchResult.searchId || bestMatch?.pet?.id !== baxterId || bestMatch.pet.medicalHistory !== undefined) fail('searching with Baxter\'s own photo did not return Baxter as the top, privacy-limited match.');
  const inquiry = expectStatus(await request('/lost-pet/inquiries', { method: 'POST', cookie: applicantCookie, body: { searchId: searchResult.searchId, petId: baxterId, phone: '(404) 555-0142', message: 'I think Baxter is my dog. He went missing near Park Place on Friday.' } }), 201, 'send a lost-pet inquiry');
  expectStatus(await request('/lost-pet/inquiries', { method: 'POST', cookie: applicantCookie, body: { searchId: searchResult.searchId, petId: baxterId, phone: '(404) 555-0142', message: 'Sending the same inquiry a second time.' } }), 409, 'a duplicate lost-pet inquiry is rejected');
  const staffInquiries = expectStatus(await request('/admin/lost-pet-inquiries', { cookie: staffCookie }), 200, 'staff sees the inquiry');
  const staffRow = staffInquiries.inquiries?.find((item) => item.id === inquiry.id);
  if (!staffRow || staffRow.photoUrls?.length !== 1 || staffRow.memberEmail !== uniqueEmail) fail('staff did not see the inquiry with the member contact details and uploaded photo.');
  const signedPhoto = await fetch(staffRow.photoUrls[0]);
  if (!signedPhoto.ok) fail('the staff signed link to the member photo did not load.');
  expectStatus(await request(`/admin/lost-pet-inquiries/${inquiry.id}`, { method: 'PUT', cookie: staffCookie, body: { status: 'In progress', staffNote: 'Called the owner to verify the microchip.' } }), 200, 'staff updates an inquiry');
  expectStatus(await request(`/admin/lost-pet-inquiries/${inquiry.id}`, { method: 'PUT', cookie: staffCookie, body: { status: 'Closed', staffNote: '' } }), 400, 'an unknown inquiry status is rejected');
  const mine = expectStatus(await request('/lost-pet/inquiries', { cookie: applicantCookie }), 200, 'member sees the inquiry status');
  if (mine.inquiries?.[0]?.status !== 'In progress' || 'staffNote' in mine.inquiries[0]) fail('the member should see the status but never the staff note.');
}


// Donations: Stripe's webhook is the only way one is recorded, and only with a valid signature.
const webhookSecret = process.env.DEMO_STRIPE_WEBHOOK_SECRET ?? 'whsec_local_demo_secret';
async function stripeWebhook(event, { secret = webhookSecret, timestamp = Math.floor(Date.now() / 1000), signed = true } = {}) {
  const body = JSON.stringify(event);
  const headers = { 'Content-Type': 'application/json' };
  if (signed) headers['Stripe-Signature'] = `t=${timestamp},v1=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;
  const response = await fetch(`${apiBase}/webhooks/stripe`, { method: 'POST', headers, body });
  return { response, body: await response.json().catch(() => null) };
}
const checkoutEvent = (sessionId, type = 'checkout.session.completed', paymentStatus = 'paid', amount = 2500) => ({
  id: `evt_${sessionId}_${type}`, type, livemode: false, data: { object: {
    object: 'checkout.session', id: sessionId, mode: 'payment', payment_status: paymentStatus, amount_total: amount, currency: 'usd',
    payment_intent: `pi_${sessionId}`, created: Math.floor(Date.now() / 1000), customer_details: { name: 'QA Donor', email: `donor-${sessionId}@example.com` },
  } },
});

expectStatus(await request('/admin/donations', { cookie: applicantCookie }), 403, 'a member cannot read donations');
expectStatus(await request('/admin/donations'), 401, 'donations require a login');
const webhookProbe = await stripeWebhook({ id: 'evt_probe', type: 'charge.refunded', data: { object: {} } });
if (webhookProbe.response.status === 503) {
  console.log('The Stripe webhook is not configured on this local API (no STRIPE_WEBHOOK_SECRET): skipped the donation checks.');
} else if (webhookProbe.response.status === 400) {
  console.log('The local STRIPE_WEBHOOK_SECRET is not the demo placeholder (set DEMO_STRIPE_WEBHOOK_SECRET to match): skipped the donation checks.');
} else {
  expectStatus(webhookProbe, 200, 'a signed event of an unrelated type is acknowledged');
  if (webhookProbe.body?.recorded !== false) fail('an unrelated Stripe event should be acknowledged without recording anything.');
  const sessionId = `cs_test_qa_${Date.now()}`;
  expectStatus(await stripeWebhook(checkoutEvent(sessionId), { signed: false }), 400, 'an unsigned webhook is rejected');
  expectStatus(await stripeWebhook(checkoutEvent(sessionId), { secret: 'whsec_wrong' }), 400, 'a webhook signed with the wrong secret is rejected');
  expectStatus(await stripeWebhook(checkoutEvent(sessionId), { timestamp: Math.floor(Date.now() / 1000) - 3600 }), 400, 'a stale signed webhook is rejected');
  expectStatus(await request('/webhooks/stripe', { method: 'POST', body: checkoutEvent(sessionId) }), 400, 'a browser-style request without a signature is rejected');
  const before = expectStatus(await request('/admin/donations', { cookie: staffCookie }), 200, 'staff donations before recording');
  if (before.donations.some((item) => item.donorEmail === `donor-${sessionId}@example.com`)) fail('a rejected webhook must not record a donation.');

  const pending = await stripeWebhook(checkoutEvent(sessionId, 'checkout.session.completed', 'unpaid'));
  expectStatus(pending, 200, 'a delayed payment is recorded as pending');
  if (pending.body?.status !== 'pending') fail('an unpaid checkout session should be recorded as pending.');
  expectStatus(await stripeWebhook(checkoutEvent(sessionId, 'checkout.session.async_payment_succeeded', 'paid')), 200, 'the confirmed payment upgrades the donation');
  const late = await stripeWebhook(checkoutEvent(sessionId, 'checkout.session.completed', 'unpaid'));
  if (late.body?.status !== 'succeeded') fail('a late pending event must not downgrade a succeeded donation.');
  expectStatus(await stripeWebhook(checkoutEvent(sessionId, 'checkout.session.async_payment_succeeded', 'paid')), 200, 'replaying an event is harmless');
  const ignored = await stripeWebhook({ ...checkoutEvent(`${sessionId}_sub`), data: { object: { ...checkoutEvent(sessionId).data.object, id: `${sessionId}_sub`, mode: 'subscription' } } });
  if (ignored.body?.recorded !== false) fail('a subscription checkout must not be recorded as a donation.');
  const failedId = `${sessionId}_failed`;
  expectStatus(await stripeWebhook(checkoutEvent(failedId, 'checkout.session.async_payment_failed', 'unpaid', 700)), 200, 'a failed asynchronous payment is recorded');

  const donations = expectStatus(await request('/admin/donations', { cookie: staffCookie }), 200, 'staff donations after recording');
  const mine = donations.donations.filter((item) => item.donorEmail === `donor-${sessionId}@example.com`);
  if (mine.length !== 1 || mine[0].status !== 'succeeded' || mine[0].amountCents !== 2500 || mine[0].livemode !== false || mine[0].donorName !== 'QA Donor') fail('staff should see exactly one succeeded $25.00 test donation for the session.');
  if (!donations.donations.some((item) => item.donorEmail === `donor-${failedId}@example.com` && item.status === 'failed')) fail('staff should see the failed donation.');
  const testTotal = donations.totals.find((total) => total.livemode === false && total.currency === 'usd');
  if (!testTotal || testTotal.totalCents < 2500 || testTotal.count < 1) fail('the test-mode total should include the succeeded donation.');
  if (donations.totals.some((total) => total.livemode === true)) fail('no live-mode total should exist after test-mode events.');
}


// Saved profile, recorded pet attributes, and the opt-in review shortcut.
expectStatus(await request('/profile'), 401, 'the saved profile requires a login');
const emptyProfile = expectStatus(await request('/profile', { cookie: applicantCookie }), 200, 'a new member has no saved details');
if (emptyProfile.profile?.phone !== null || emptyProfile.profile?.address !== null || emptyProfile.profile?.dateOfBirth !== null) fail('a new member should have an empty profile.');
const badProfile = await request('/profile', { method: 'PUT', cookie: applicantCookie, body: { phone: '12', address: 'x', dateOfBirth: '2999-01-01' } });
expectStatus(badProfile, 400, 'invalid saved details are rejected');
for (const fieldName of ['phone', 'address', 'dateOfBirth']) if (!badProfile.body?.fieldErrors?.[fieldName]) fail(`the profile rejection did not identify the ${fieldName} field.`);
const savedProfile = expectStatus(await request('/profile', { method: 'PUT', cookie: applicantCookie, body: { phone: '(404) 555-0142', address: '55 Park Place NE, Atlanta, GA 30303', dateOfBirth: '1990-04-12' } }), 200, 'save contact details');
if (savedProfile.profile?.phone !== '(404) 555-0142' || savedProfile.profile?.dateOfBirth !== '1990-04-12') fail('the saved profile did not keep the submitted details.');
const clearedPhone = expectStatus(await request('/profile', { method: 'PUT', cookie: applicantCookie, body: { phone: '', address: savedProfile.profile.address, dateOfBirth: savedProfile.profile.dateOfBirth } }), 200, 'an empty field clears a saved detail');
if (clearedPhone.profile?.phone !== null || !clearedPhone.profile?.address) fail('clearing the phone should leave the other saved details alone.');
const otherMember = await request('/auth/register', { method: 'POST', body: { name: 'Profile Isolation', email: `isolation-${Date.now()}@pawheaven.local`, password: qaPassword } });
expectStatus(otherMember, 201, 'register a second member for profile isolation');
if ((await request('/profile', { cookie: otherMember.cookie })).body?.profile?.address !== null) fail('one member must never see another member\'s saved details.');

const searchBlackDog = expectStatus(await request('/pets?search=black%20dog'), 200, 'search by color and species');
if (!searchBlackDog.pets?.some((pet) => pet.id === baxterId) || searchBlackDog.pets.some((pet) => pet.name === 'Wren')) fail('"black dog" should find Baxter (black, white and tan) and not Wren (tan and white).');
const baxterDetails = expectStatus(await request(`/pets/${baxterId}`), 200, 'pet details include recorded attributes');
if (baxterDetails.color !== 'Black, white and tan' || baxterDetails.goodWithKids !== 'Yes' || baxterDetails.weightLbs !== 82 || baxterDetails.energyLevel !== 'Low') fail('the pet details did not carry the recorded attributes.');
const badAttributes = await request('/admin/pets', { method: 'POST', cookie: staffCookie, body: { name: 'QA Attributes', type: 'Dog', breed: 'Mixed', age: '2 years', intakeDate: '2026-10-01', tags: [], status: 'Available', summary: 'Temporary QA record.', size: 'Gigantic', goodWithKids: 'Maybe', weightLbs: 9000 } });
expectStatus(badAttributes, 400, 'invalid pet attributes are rejected');
for (const fieldName of ['size', 'goodWithKids', 'weightLbs']) if (!badAttributes.body?.fieldErrors?.[fieldName]) fail(`the attribute rejection did not identify the ${fieldName} field.`);
const attributedPet = expectStatus(await request('/admin/pets', { method: 'POST', cookie: staffCookie, body: { name: 'QA Shortcut', type: 'Cat', breed: 'Mixed', age: '2 years', intakeDate: '2026-10-01', tags: ['qa'], status: 'Available', summary: 'Temporary QA record.', fosterAvailable: true, sex: 'Female', size: 'Small', color: 'Calico', weightLbs: 9, spayedNeutered: 'Yes', goodWithKids: 'Yes', goodWithDogs: 'No', goodWithCats: 'Unknown', energyLevel: 'Medium' } }), 201, 'staff creates a pet with attributes');
if (attributedPet.color !== 'Calico' || attributedPet.weightLbs !== 9 || attributedPet.goodWithDogs !== 'No') fail('the created pet did not keep its attributes.');
const keptAttributes = expectStatus(await request(`/admin/pets/${attributedPet.id}`, { method: 'PUT', cookie: staffCookie, body: { name: 'QA Shortcut', type: 'Cat', breed: 'Mixed', age: '3 years', intakeDate: '2026-10-01', tags: ['qa'], status: 'Available', summary: 'Temporary QA record, edited.', fosterAvailable: true } }), 200, 'an update that omits attributes leaves them alone');
if (keptAttributes.color !== 'Calico' || keptAttributes.age !== '3 years') fail('omitting attributes on an update must not wipe them.');

// An approval changes a pet only when staff explicitly ask for it.
const shortcutApplication = expectStatus(await request(`/foster-applications/pets/${attributedPet.id}`, { method: 'POST', cookie: applicantCookie, body: fosterDetails }), 201, 'apply to foster the shortcut pet');
const declinedWithShortcut = expectStatus(await request(`/admin/foster-applications/${shortcutApplication.id}`, { method: 'PUT', cookie: staffCookie, body: { status: 'Declined', markPetStatus: 'Fostered' } }), 200, 'a decline ignores the pet shortcut');
if (declinedWithShortcut.petStatusUpdate !== 'not_requested') fail('a declined application must never change the pet.');
const availableShortcut = expectStatus(await request(`/admin/foster-applications/${shortcutApplication.id}`, { method: 'PUT', cookie: staffCookie, body: { status: 'Approved', markPetStatus: 'Available' } }), 200, 'an approval cannot "mark" a pet Available');
if (availableShortcut.petStatusUpdate !== 'not_requested') fail('Available is not a valid pet status shortcut.');
const plainApproval = expectStatus(await request(`/admin/foster-applications/${shortcutApplication.id}`, { method: 'PUT', cookie: staffCookie, body: { status: 'Approved' } }), 200, 'an approval alone');
if (plainApproval.petStatusUpdate !== 'not_requested' || (await request('/admin/pets', { cookie: staffCookie })).body.pets.find((pet) => pet.id === attributedPet.id)?.status !== 'Available') fail('an approval without the shortcut must leave the pet Available.');
const shortcutApproval = expectStatus(await request(`/admin/foster-applications/${shortcutApplication.id}`, { method: 'PUT', cookie: staffCookie, body: { status: 'Approved', markPetStatus: 'Fostered' } }), 200, 'an approval with the shortcut');
if (shortcutApproval.petStatusUpdate !== 'applied' || (await request('/admin/pets', { cookie: staffCookie })).body.pets.find((pet) => pet.id === attributedPet.id)?.status !== 'Fostered') fail('the shortcut should have marked the pet Fostered.');

// Staff role: limited to pets, applications, and the visit schedule.
const superCookie = await login(superuserEmail, superuserPassword);
const staffIdentity = expectStatus(await request('/admin/me', { cookie: staffCookie }), 200, 'staff portal access');
if (staffIdentity.user?.role !== 'staff') fail('the demo staff account did not report the staff role.');
expectStatus(await request('/admin/pets', { cookie: staffCookie }), 200, 'staff can list pets');
expectStatus(await request('/admin/applications', { cookie: staffCookie }), 200, 'staff can list applications');
expectStatus(await request('/admin/visit-slots', { cookie: staffCookie }), 200, 'staff can view the visit schedule');
expectStatus(await request('/admin/users', { cookie: staffCookie }), 200, 'staff can list member accounts');
expectStatus(await request('/admin/invitations', { cookie: staffCookie }), 403, 'staff cannot view staff invitations');
expectStatus(await request('/admin/invitations', { cookie: superCookie }), 200, 'a superuser can view staff invitations');
const superIdentity = expectStatus(await request('/admin/me', { cookie: superCookie }), 200, 'superuser portal access');
if (superIdentity.user?.role !== 'superuser') fail('the demo superuser did not report the superuser role.');

// Pet validation reports every incorrect field and the new care details round-trip.
const invalidPet = await request('/admin/pets', { method: 'POST', cookie: staffCookie, body: { name: '', type: '', breed: 'Mixed', age: '2 years', intakeDate: '2999-01-01', tags: [], status: 'Available', summary: '' } });
expectStatus(invalidPet, 400, 'invalid pet is rejected');
for (const fieldName of ['name', 'type', 'intakeDate', 'summary']) {
  if (!invalidPet.body?.fieldErrors?.[fieldName]) fail(`invalid pet rejection did not identify the ${fieldName} field.`);
}
const createdPet = expectStatus(await request('/admin/pets', {
  method: 'POST', cookie: staffCookie,
  body: { name: 'QA Fosterling', type: 'Cat', breed: 'Mixed', age: '1 year', intakeDate: '2026-10-01', tags: ['qa'], status: 'Unavailable', summary: 'Temporary QA record.', medicalHistory: 'Vaccinations current.', fosterAvailable: true },
}), 201, 'staff can create a pet');
if (createdPet.status !== 'Unavailable' || createdPet.medicalHistory !== 'Vaccinations current.' || createdPet.fosterAvailable !== true) fail('the created pet did not keep its status, medical history, and foster flag.');
expectStatus(await request(`/pets/${createdPet.id}`), 404, 'an unavailable pet stays hidden from the public');
expectStatus(await request(`/admin/pets/${createdPet.id}`, { method: 'DELETE', cookie: staffCookie }), 200, 'staff can remove a pet');

// A superuser assigns the staff role; the change takes effect on the member's next request.
const applicantIdentity = expectStatus(await request('/auth/me', { cookie: applicantCookie }), 200, 'applicant identity');
expectStatus(await request('/admin/pets', { cookie: applicantCookie }), 403, 'member starts without staff access');
expectStatus(await request(`/admin/users/${applicantIdentity.user.id}/role`, { method: 'PUT', cookie: staffCookie, body: { role: 'staff' } }), 403, 'staff cannot assign roles');
expectStatus(await request(`/admin/users/${applicantIdentity.user.id}/role`, { method: 'PUT', cookie: superCookie, body: { role: 'owner' } }), 400, 'an unknown role is rejected');
expectStatus(await request(`/admin/users/${applicantIdentity.user.id}/role`, { method: 'PUT', cookie: superCookie, body: { role: 'staff' } }), 200, 'superuser promotes a member to staff');
expectStatus(await request('/admin/pets', { cookie: applicantCookie }), 200, 'promoted member can use staff features');
expectStatus(await request(`/admin/users/${applicantIdentity.user.id}/role`, { method: 'PUT', cookie: superCookie, body: { role: 'member' } }), 200, 'superuser returns the account to member');
expectStatus(await request('/admin/pets', { cookie: applicantCookie }), 403, 'demoted account loses staff features');

// Self-service password change requires the current password and the password policy.
expectStatus(await request('/auth/change-password', { method: 'POST', cookie: applicantCookie, body: { currentPassword: 'Wrong-Password-1!', newPassword: 'Another-Pass-2026!' } }), 400, 'wrong current password is rejected');
expectStatus(await request('/auth/change-password', { method: 'POST', cookie: applicantCookie, body: { currentPassword: qaPassword, newPassword: 'weakpassword' } }), 400, 'weak new password is rejected');
expectStatus(await request('/auth/change-password', { method: 'POST', cookie: applicantCookie, body: { currentPassword: qaPassword, newPassword: 'Another-Pass-2026!' } }), 200, 'password change succeeds');
expectStatus(await request('/auth/login', { method: 'POST', body: { email: uniqueEmail, password: 'Another-Pass-2026!' } }), 200, 'login with the changed password');
expectStatus(await request('/auth/email', { method: 'PUT', cookie: applicantCookie, body: { email: `changed-${uniqueEmail}`, currentPassword: 'Wrong-Password-1!' } }), 400, 'email change requires the current password');

const attentionHas = (payload, kind) => Array.isArray(payload.items) && payload.items.some((item) => item.kind === kind);

// Get Involved: open hours, capacity visits with pets, events, pet quick actions, the foster pool, the schedule, and attention.
const feed = expectStatus(await request('/get-involved'), 200, 'the public what-is-open feed');
if (!Array.isArray(feed.visits) || !Array.isArray(feed.shifts) || !Array.isArray(feed.events) || typeof feed.foster?.open !== 'number') fail('the what-is-open feed is missing sections.');
const publicAvailability = expectStatus(await request('/public/availability'), 200, 'guests can read open visit times and shifts');
if (!Array.isArray(publicAvailability.visits) || !Array.isArray(publicAvailability.shifts)) fail('the public availability is missing sections.');
if (publicAvailability.visits.some((visit) => !visit.id || visit.spotsLeft < 1) || publicAvailability.shifts.some((shift) => !shift.id || shift.spotsLeft < 1 || typeof shift.minAge !== 'number')) fail('the public availability returned a full or unidentified entry.');
if (JSON.stringify(publicAvailability).includes('@')) fail('the public availability leaked an email address.');
const shelterStatus = expectStatus(await request('/public/shelter-status'), 200, 'guests can read the shelter status');
if (!Array.isArray(shelterStatus.groups) || shelterStatus.groups.length !== 3 || typeof shelterStatus.needHelp !== 'number' || shelterStatus.groups.some((group) => !['unset', 'ok', 'busy', 'full', 'over'].includes(group.level) || typeof group.used !== 'number')) fail('the shelter status is malformed.');
if (JSON.stringify(shelterStatus).includes('@')) fail('the shelter status leaked an email address.');
expectStatus(await request('/admin/capacity', { cookie: applicantCookie }), 403, 'a member cannot read the staff capacity view');
expectStatus(await request('/admin/capacity/Dog', { method: 'PUT', cookie: applicantCookie, body: { kennels: 20, heldBack: 0 } }), 403, 'a member cannot change capacity');
expectStatus(await request('/admin/pets/help', { method: 'POST', cookie: applicantCookie, body: { petIds: [baxterId], reason: 'foster' } }), 403, 'a member cannot flag a pet as needing help');
expectStatus(await request('/admin/availability', { cookie: applicantCookie }), 403, 'a member cannot read open hours');
expectStatus(await request('/admin/attention', { cookie: applicantCookie }), 403, 'a member cannot read the attention report');
expectStatus(await request('/admin/pets/flags', { method: 'POST', cookie: applicantCookie, body: { petIds: [baxterId], needsWalkers: true } }), 403, 'a member cannot change pet flags');

const availability = expectStatus(await request('/admin/availability', { cookie: staffCookie }), 200, 'staff read open hours');
if (!availability.rules?.length) fail('the seeded open hours were not returned.');
const badRule = await request('/admin/availability/rules', { method: 'POST', cookie: staffCookie, body: { kind: 'shift', weekday: 3, startTime: '10:00', endTime: '09:00', capacity: 1 } });
expectStatus(badRule, 400, 'an invalid open-hours rule is rejected');
if (!badRule.body?.fieldErrors?.endTime || !badRule.body?.fieldErrors?.title) fail('the invalid rule did not name the fields to fix.');
expectStatus(await request('/admin/availability/rules', { method: 'POST', cookie: staffCookie, body: { kind: 'visit', weekday: 1, startTime: '06:00', endTime: '07:00', capacity: 2, slotMinutes: 30, weeksAhead: 2 } }), 201, 'staff add a weekly visit rule');
const generated = expectStatus(await request('/admin/availability/generate', { method: 'POST', cookie: staffCookie }), 200, 'staff fill in open hours');
if (generated.visitsCreated < 1) fail('generating open hours created no visit times for the new rule.');
const again = expectStatus(await request('/admin/availability/generate', { method: 'POST', cookie: staffCookie }), 200, 'generating twice');
if (again.visitsCreated !== 0 || again.shiftsCreated !== 0) fail('generating a second time created duplicates.');
expectStatus(await request('/admin/availability/exceptions', { method: 'POST', cookie: staffCookie, body: { date: isoDay(40), reason: 'QA closed day' } }), 201, 'staff close a day');
expectStatus(await request(`/admin/availability/exceptions/${isoDay(40)}`, { method: 'DELETE', cookie: staffCookie }), 200, 'staff reopen a day');

// A two-group visit time takes two groups and turns away a third; bookings name pets and party size.
const qaStart = new Date(Date.now() + 75 * 86_400_000); qaStart.setUTCHours(15, 0, 0, 0);
const qaSlot = expectStatus(await request('/admin/visit-slots', { method: 'POST', cookie: staffCookie, body: { startsAt: qaStart.toISOString(), endsAt: new Date(qaStart.getTime() + 1_800_000).toISOString(), capacity: 2 } }), 201, 'staff publish a two-group visit time');
const capacityBooking = await request('/appointments', { method: 'POST', cookie: applicantCookie, body: { slotId: qaSlot.id, purpose: 'Meet Baxter', partySize: 3, petIds: [baxterId] } });
expectStatus(capacityBooking, 201, 'book with a party size and a pet');
expectStatus(await request('/appointments', { method: 'POST', cookie: applicantCookie, body: { slotId: qaSlot.id, purpose: 'Again' } }), 409, 'the same member cannot double book');
expectStatus(await request('/appointments', { method: 'POST', cookie: applicantCookie, body: { slotId: qaSlot.id, purpose: 'Too many', partySize: 9 } }), 400, 'a party over six is rejected');
const memberAppointments = expectStatus(await request('/appointments', { cookie: applicantCookie }), 200, 'appointments with pets');
const withPets = memberAppointments.appointments.find((appointment) => appointment.id === capacityBooking.body.appointmentId);
if (withPets?.partySize !== 3 || withPets.pets?.[0]?.id !== baxterId) fail('the booking did not keep the party size and the pet.');
const guests = [];
for (const label of ['b', 'c']) {
  const guest = await request('/auth/register', { method: 'POST', body: { name: `Capacity ${label}`, email: `capacity-${label}-${Date.now()}@pawheaven.local`, password: qaPassword } });
  expectStatus(guest, 201, `register capacity guest ${label}`);
  guests.push(guest.cookie);
}
expectStatus(await request('/appointments', { method: 'POST', cookie: guests[0], body: { slotId: qaSlot.id, purpose: 'Second group' } }), 201, 'a second group fits');
expectStatus(await request('/appointments', { method: 'POST', cookie: guests[1], body: { slotId: qaSlot.id, purpose: 'Third group' } }), 409, 'a third group is turned away');
const fullSlot = expectStatus(await request('/visit-slots', { cookie: guests[1] }), 200, 'slots for a guest').slots.find((slot) => slot.id === qaSlot.id);
if (fullSlot?.available !== false || fullSlot.spotsLeft !== 0 || fullSlot.capacity !== 2) fail('the full slot did not report its capacity.');
const scheduleView = expectStatus(await request('/admin/visit-slots', { cookie: staffCookie }), 200, 'the staff schedule with bookings');
if (scheduleView.slots.find((slot) => slot.id === qaSlot.id)?.appointments?.length !== 2) fail('staff did not see both booked groups.');
expectStatus(await request(`/admin/visit-slots/${qaSlot.id}/capacity`, { method: 'PUT', cookie: staffCookie, body: { capacity: 1 } }), 409, 'capacity cannot drop below the booked groups');

// An open house creates visits, roles, and featured pets together.
const eventStart = new Date(Date.now() + 50 * 86_400_000); eventStart.setUTCHours(14, 0, 0, 0);
const eventBody = { title: 'QA Open House', description: 'Meet the animals.', startsAt: eventStart.toISOString(), endsAt: new Date(eventStart.getTime() + 7_200_000).toISOString(), visitCapacity: 2, slotMinutes: 30, roles: [{ title: 'QA Greeters', capacity: 2 }], petIds: [baxterId] };
expectStatus(await request('/admin/events', { method: 'POST', cookie: staffCookie, body: { ...eventBody, visitCapacity: 0, roles: [] } }), 400, 'an event needs visits or roles');
// Demo bookings can fill a day, so try the following days until one has no booked visits in the way.
let openHouse = await request('/admin/events', { method: 'POST', cookie: staffCookie, body: eventBody });
for (let day = 1; openHouse.response.status === 409 && day <= 6; day += 1) {
  const later = new Date(eventStart.getTime() + day * 86_400_000);
  Object.assign(eventBody, { startsAt: later.toISOString(), endsAt: new Date(later.getTime() + 7_200_000).toISOString() });
  openHouse = await request('/admin/events', { method: 'POST', cookie: staffCookie, body: eventBody });
}
expectStatus(openHouse, 201, 'staff create an open house');
const events = expectStatus(await request('/admin/events', { cookie: staffCookie }), 200, 'staff list events');
if (!events.events.some((event) => event.title === 'QA Open House' && event.pets.some((pet) => pet.id === baxterId))) fail('the event or its featured pet is missing.');
const feedAfter = expectStatus(await request('/get-involved'), 200, 'the feed after the event');
if (!feedAfter.events.some((event) => event.title === 'QA Open House')) fail('the public feed does not show the new event.');

// Pet quick actions apply in bulk and show on the public listing.
expectStatus(await request('/admin/pets/flags', { method: 'POST', cookie: staffCookie, body: { petIds: [] , needsWalkers: true } }), 400, 'bulk flags need a pet');
expectStatus(await request('/admin/pets/flags', { method: 'POST', cookie: staffCookie, body: { petIds: [baxterId], needsWalkers: true, visitsOpen: false } }), 200, 'staff flag a pet in bulk');
const flagged = expectStatus(await request(`/pets/${baxterId}`), 200, 'the flagged pet');
if (flagged.needsWalkers !== true || flagged.visitsOpen !== false) fail('the pet flags did not reach the public listing.');
expectStatus(await request('/admin/pets/flags', { method: 'POST', cookie: staffCookie, body: { petIds: [baxterId], needsWalkers: false, visitsOpen: true } }), 200, 'staff clear the flags');
expectStatus(await request('/appointments', { method: 'POST', cookie: guests[1], body: { slotId: qaSlot.id, purpose: 'Hidden pet', petIds: ['00000000-0000-4000-8000-000000000000'] } }), 409, 'an unknown or unavailable pet is rejected');

// Foster pool: alerts are for approved fosters; staff can ask the pool and see the request.
expectStatus(await request('/me/foster-alerts', { method: 'PUT', cookie: guests[1], body: { optIn: true } }), 409, 'foster alerts need an approved foster application');
const fosterAsk = expectStatus(await request('/admin/foster-requests', { method: 'POST', cookie: staffCookie, body: { petId: baxterId, note: 'QA: needs a quiet home.' } }), 201, 'staff ask the foster pool');
if (typeof fosterAsk.notified !== 'number') fail('the foster request did not report how many people were asked.');
expectStatus(await request('/admin/foster-requests', { method: 'POST', cookie: staffCookie, body: { petId: baxterId } }), 409, 'a pet cannot have two open requests');
const requests = expectStatus(await request('/admin/foster-requests', { cookie: staffCookie }), 200, 'staff list foster requests');
const openRequest = requests.requests.find((item) => item.petId === baxterId && !item.closedAt);
if (!openRequest) fail('the open foster request is missing.');
expectStatus(await request(`/admin/foster-requests/${openRequest.id}/close`, { method: 'POST', cookie: staffCookie }), 200, 'staff close the request');
expectStatus(await request('/foster-requests', { cookie: guests[1] }), 200, 'a member lists their foster requests');
expectStatus(await request('/admin/volunteer-foster-candidates', { cookie: staffCookie }), 200, 'staff list volunteers who might foster');

// The member schedule, calendar export, involvement, and the staff attention report.
const mySchedule = expectStatus(await request('/me/schedule', { cookie: applicantCookie }), 200, 'the member schedule');
if (!mySchedule.entries.some((entry) => entry.kind === 'visit' && /Baxter/.test(entry.detail))) fail('the schedule does not show the visit with its pet.');
const ics = await fetch(`${apiBase}/me/schedule.ics`, { headers: { Cookie: applicantCookie } });
const icsText = await ics.text();
if (ics.status !== 200 || !ics.headers.get('content-type')?.startsWith('text/calendar') || !icsText.startsWith('BEGIN:VCALENDAR') || !icsText.includes('SUMMARY:Shelter visit')) fail('the calendar export is not valid.');
expectStatus(await request('/me/schedule.ics'), 401, 'the calendar export needs a session');
const involvement = expectStatus(await request('/me/involvement', { cookie: applicantCookie }), 200, 'member involvement');
if (typeof involvement.volunteerShifts !== 'number' || typeof involvement.approvedFoster !== 'boolean') fail('the involvement summary is incomplete.');
const attention = expectStatus(await request('/admin/attention', { cookie: staffCookie }), 200, 'the staff attention report');
if (!Array.isArray(attention.items) || attention.items.some((item) => !item.title || !item.action)) fail('the attention items are malformed.');

// Shelter status: capacity and the needs-help flag, restored to what they were.
const capacityBefore = expectStatus(await request('/admin/capacity', { cookie: staffCookie }), 200, 'staff read kennel capacity');
const dogBefore = capacityBefore.groups.find((group) => group.group === 'Dog');
expectStatus(await request('/admin/capacity/Dog', { method: 'PUT', cookie: staffCookie, body: { kennels: 5, heldBack: 6 } }), 400, 'held-back kennels cannot exceed kennels');
expectStatus(await request('/admin/capacity/Bird', { method: 'PUT', cookie: staffCookie, body: { kennels: 5, heldBack: 0 } }), 404, 'capacity needs a known group');
const capacityTight = expectStatus(await request('/admin/capacity/Dog', { method: 'PUT', cookie: staffCookie, body: { kennels: dogBefore.used, heldBack: 0 } }), 200, 'staff set dog capacity to the number of dogs');
if (capacityTight.groups.find((group) => group.group === 'Dog')?.level !== 'full') fail('dogs should be full when kennels equal dogs.');
if (!attentionHas(expectStatus(await request('/admin/attention', { cookie: staffCookie }), 200, 'attention with full kennels'), 'capacity_high')) fail('the attention report should warn when kennels are full.');
expectStatus(await request('/admin/capacity/Dog', { method: 'PUT', cookie: staffCookie, body: { kennels: dogBefore.kennels, heldBack: dogBefore.heldBack } }), 200, 'staff restore dog capacity');
const baxterBefore = expectStatus(await request(`/pets/${baxterId}`), 200, 'the public pet before flagging');
expectStatus(await request('/admin/pets/help', { method: 'POST', cookie: staffCookie, body: { petIds: [baxterId], reason: 'sad' } }), 400, 'the help reason must be on the list');
expectStatus(await request('/admin/pets/help', { method: 'POST', cookie: staffCookie, body: { petIds: [], reason: 'foster' } }), 400, 'the help flag needs at least one pet');
expectStatus(await request('/admin/pets/help', { method: 'POST', cookie: staffCookie, body: { petIds: [baxterId], reason: 'medical' } }), 200, 'staff flag a pet as needing help');
const baxterFlagged = expectStatus(await request(`/pets/${baxterId}`), 200, 'the public pet after flagging');
if (baxterFlagged.helpReason !== 'medical' || !baxterFlagged.helpSince) fail('the public pet should show the help reason.');
if (JSON.stringify(baxterFlagged).includes('helpNote')) fail('a private help note leaked.');
expectStatus(await request('/admin/pets/help', { method: 'POST', cookie: staffCookie, body: { petIds: [baxterId], reason: baxterBefore.helpReason } }), 200, 'staff restore the pet flag');

expectStatus(await request('/auth/logout', { method: 'POST', cookie: staffCookie }), 200, 'staff logout');
expectStatus(await request('/auth/logout', { method: 'POST', cookie: applicantCookie }), 200, 'applicant logout');
expectStatus(await request('/auth/logout', { method: 'POST', cookie: superCookie }), 200, 'superuser logout');

console.log('Demo QA passed: discovery, authorization, password policy, staff role and role assignment, pet field validation, adoption contact validation and review, foster applications, volunteer shifts, AI quiz and lost-pet validation and limits, signed Stripe webhook donation recording, saved profile and pet attributes with the opt-in review shortcut, visit booking/reschedule/cancellation history, staff visit scheduling, open hours generation, capacity visits with pets, open house events, pet quick actions, the foster pool, the member schedule and calendar export, the attention report, shelter status (capacity levels and the needs-help flag), session expiry, and logout.');
