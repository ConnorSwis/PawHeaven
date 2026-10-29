import type { AdoptionApplicationStatus, AppointmentEventType } from '@pawheaven/contracts';
import type { EmailMessage } from './email';

const SHELTER_TIME_ZONE = 'America/New_York';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
}

export function formatShelterTime(startsAt: string, endsAt: string): string {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const date = new Intl.DateTimeFormat('en-US', { timeZone: SHELTER_TIME_ZONE, weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }).format(start);
  const range = new Intl.DateTimeFormat('en-US', { timeZone: SHELTER_TIME_ZONE, hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).formatRange(start, end);
  return `${date}, ${range}`;
}

function layout(heading: string, paragraphs: string[]): { html: string; text: string } {
  const html = `<!doctype html><html><body style="margin:0;background:#f5f1e8;font-family:Arial,Helvetica,sans-serif;color:#1c1917">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #d6d3d1">
<tr><td style="padding:20px 28px;background:#3f5a36;color:#ffffff;font-size:18px;font-weight:bold">PawHeaven</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 16px;font-size:22px">${escapeHtml(heading)}</h1>
${paragraphs.map((paragraph) => `<p style="margin:0 0 14px;line-height:1.6;font-size:15px">${escapeHtml(paragraph)}</p>`).join('\n')}
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #e7e5e4;font-size:12px;color:#57534e">You are receiving this message because of activity on your PawHeaven account.</td></tr>
</table></td></tr></table></body></html>`;
  return { html, text: `${heading}\n\n${paragraphs.join('\n\n')}\n\n— PawHeaven` };
}

export function appointmentEmail(input: {
  to: string;
  name: string;
  event: AppointmentEventType;
  startsAt: string;
  endsAt: string;
  purpose?: string;
}): EmailMessage {
  const when = formatShelterTime(input.startsAt, input.endsAt);
  const verb = { booked: 'confirmed', rescheduled: 'rescheduled', canceled: 'canceled' }[input.event];
  const heading = `Your shelter visit is ${verb}`;
  const paragraphs = [`Hi ${input.name},`];
  if (input.event === 'canceled') {
    paragraphs.push(`Your visit on ${when} was canceled, and the time is open for someone else. You can book a new visit any time from your PawHeaven account.`);
  } else {
    paragraphs.push(`Your visit is ${verb} for ${when}.`);
    if (input.purpose) paragraphs.push(`Reason for your visit: ${input.purpose}`);
    paragraphs.push('You can reschedule or cancel from your PawHeaven account.');
  }
  const { html, text } = layout(heading, paragraphs);
  return { to: input.to, subject: heading, html, text };
}

export function applicationReceivedEmail(input: { to: string; name: string; petName: string }): EmailMessage {
  const heading = `We received your application for ${input.petName}`;
  const { html, text } = layout(heading, [
    `Hi ${input.name},`,
    `Thank you for applying to adopt ${input.petName}. Your application is pending and a member of the shelter team will review it.`,
    `Submitting an application does not reserve ${input.petName}. We will email you when there is an update, and you can also check its status in your PawHeaven account.`,
  ]);
  return { to: input.to, subject: heading, html, text };
}

export function applicationOutcomeEmail(input: { to: string; name: string; petName: string; status: AdoptionApplicationStatus }): EmailMessage {
  const heading = `Update on your application for ${input.petName}`;
  const outcome = {
    'In review': `Your application is now being reviewed by the shelter team. We will be in touch once a decision has been made.`,
    Approved: `Good news: your application was approved. A member of the shelter team will contact you about next steps.`,
    Declined: `After review, the shelter was not able to approve this application. Thank you for your interest in ${input.petName}; we hope you will consider other animals who are looking for homes.`,
    Pending: 'Your application is pending review.',
  }[input.status];
  const { html, text } = layout(heading, [`Hi ${input.name},`, outcome, 'You can see the latest status in your PawHeaven account.']);
  return { to: input.to, subject: heading, html, text };
}

function formatCalendarDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(`${value}T00:00:00Z`));
}

export function fosterReceivedEmail(input: { to: string; name: string; petName: string; availableFrom: string; availableUntil: string }): EmailMessage {
  const heading = `We received your foster application for ${input.petName}`;
  const { html, text } = layout(heading, [
    `Hi ${input.name},`,
    `Thank you for offering to foster ${input.petName}. Your application is pending and a member of the shelter team will review it. You told us you can provide care from ${formatCalendarDate(input.availableFrom)} to ${formatCalendarDate(input.availableUntil)}.`,
    `Submitting an application does not approve a placement or reserve ${input.petName}. We will email you when there is an update, and you can also check its status in your PawHeaven account.`,
  ]);
  return { to: input.to, subject: heading, html, text };
}

export function fosterOutcomeEmail(input: { to: string; name: string; petName: string; status: AdoptionApplicationStatus }): EmailMessage {
  const heading = `Update on your foster application for ${input.petName}`;
  const outcome = {
    'In review': 'Your foster application is now being reviewed by the shelter team. We will be in touch once a decision has been made.',
    Approved: 'Good news: your foster application was approved. A member of the shelter team will contact you about next steps.',
    Declined: `After review, the shelter was not able to approve this foster application. Thank you for your willingness to help ${input.petName}; we hope you will consider other animals who need a temporary home.`,
    Pending: 'Your foster application is pending review.',
  }[input.status];
  const { html, text } = layout(heading, [`Hi ${input.name},`, outcome, 'You can see the latest status in your PawHeaven account.']);
  return { to: input.to, subject: heading, html, text };
}

export function volunteerRegistrationEmail(input: {
  to: string;
  name: string;
  event: 'registered' | 'canceled';
  title: string;
  startsAt: string;
  endsAt: string;
  requirements?: string;
}): EmailMessage {
  const when = formatShelterTime(input.startsAt, input.endsAt);
  const heading = input.event === 'registered' ? `You are signed up to volunteer: ${input.title}` : `Your volunteer shift was canceled: ${input.title}`;
  const paragraphs = [`Hi ${input.name},`];
  if (input.event === 'registered') {
    paragraphs.push(`Thank you for volunteering. You are registered for "${input.title}" on ${when}.`);
    if (input.requirements) paragraphs.push(`Please remember: ${input.requirements}`);
    paragraphs.push('You can cancel from your PawHeaven account if your plans change, so another volunteer can take your spot.');
  } else {
    paragraphs.push(`Your registration for "${input.title}" on ${when} was canceled, and the spot is open for someone else. You can sign up for another shift any time from your PawHeaven account.`);
  }
  const { html, text } = layout(heading, paragraphs);
  return { to: input.to, subject: heading, html, text };
}

export function volunteerShiftCanceledEmail(input: { to: string; name: string; title: string; startsAt: string; endsAt: string }): EmailMessage {
  const heading = `The volunteer shift "${input.title}" was canceled`;
  const { html, text } = layout(heading, [
    `Hi ${input.name},`,
    `The shelter had to cancel "${input.title}" on ${formatShelterTime(input.startsAt, input.endsAt)}, and your registration was canceled with it. We are sorry for the change and appreciate your willingness to help.`,
    'You can sign up for another shift from your PawHeaven account.',
  ]);
  return { to: input.to, subject: heading, html, text };
}

export function lostPetInquiryReceivedEmail(input: { to: string; name: string; petName: string }): EmailMessage {
  const heading = `We received your question about ${input.petName}`;
  const { html, text } = layout(heading, [
    `Hi ${input.name},`,
    `Your message about ${input.petName} was sent to the shelter team. A photo match is only a first step, so staff will review it and contact you using the phone number and email on your account.`,
    'If this is urgent, please call the shelter directly. You can see the status of your inquiry in your PawHeaven account.',
  ]);
  return { to: input.to, subject: heading, html, text };
}

export function lostPetInquiryStaffEmail(input: { to: string; memberName: string; memberEmail: string; memberPhone: string; petName: string; message: string }): EmailMessage {
  const heading = `New lost-pet inquiry about ${input.petName}`;
  const { html, text } = layout(heading, [
    `${input.memberName} (${input.memberEmail}, ${input.memberPhone}) thinks ${input.petName} may be their lost pet.`,
    `Message: ${input.message}`,
    'Open the staff portal to review the photos they uploaded and record what you find. A visual match does not confirm ownership.',
  ]);
  return { to: input.to, subject: heading, html, text };
}

export function fosterRequestEmail(input: { to: string; name: string; petName: string; note: string }): EmailMessage {
  const heading = `${input.petName} needs a foster home`;
  const paragraphs = [
    `Hi ${input.name},`,
    `The shelter is looking for a foster home for ${input.petName}, and you asked to hear about these. If you can help, you can accept in one step from your PawHeaven account; we will file your foster application from your saved details.`,
  ];
  if (input.note) paragraphs.push(`A note from the shelter: ${input.note}`);
  paragraphs.push('Sign in and open My PawHeaven to accept or decline. You can turn these alerts off from your profile at any time.');
  const { html, text } = layout(heading, paragraphs);
  return { to: input.to, subject: heading, html, text };
}

export function fosterInvitationEmail(input: { to: string; name: string }): EmailMessage {
  const heading = 'Would you consider fostering?';
  const { html, text } = layout(heading, [
    `Hi ${input.name},`,
    'Thank you for all the time you have given as a volunteer. You already know our animals and our team, which makes you a great fit to foster. A foster home gives an animal a break from the kennel and helps us make room for others.',
    'If you are interested, sign in and open My PawHeaven to see how to apply. There is no obligation, and you can dismiss this invitation.',
  ]);
  return { to: input.to, subject: heading, html, text };
}

export function reminderEmail(input: { to: string; name: string; kind: 'visit' | 'shift'; title: string; startsAt: string; endsAt: string; detail: string }): EmailMessage {
  const when = formatShelterTime(input.startsAt, input.endsAt);
  const heading = input.kind === 'visit' ? 'Reminder: your shelter visit is coming up' : `Reminder: you volunteer soon (${input.title})`;
  const paragraphs = [`Hi ${input.name},`, input.kind === 'visit' ? `This is a reminder of your shelter visit on ${when}.` : `This is a reminder that you are signed up for "${input.title}" on ${when}.`];
  if (input.detail) paragraphs.push(input.kind === 'visit' ? `Reason for your visit: ${input.detail}` : `Duties: ${input.detail}`);
  paragraphs.push('Plans changed? You can reschedule or cancel from your PawHeaven account so someone else can take the place.');
  const { html, text } = layout(heading, paragraphs);
  return { to: input.to, subject: heading, html, text };
}
