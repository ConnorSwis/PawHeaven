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
