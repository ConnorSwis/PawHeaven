import { HELP_REASON_LABELS, NEWSLETTER_BLOCK_LABELS, type Newsletter, type NewsletterBlock, type UnsubscribeScope } from '@pawheaven/contracts';
import { SHELTER } from '@pawheaven/contracts/site';
import { sendEmailBatch, type EmailMessage } from './email';
import { petForClient, type DatabasePet } from './pets';
import { signUnsubscribeToken } from './unsubscribe';
import { supabaseAdmin } from './supabase';

const SHELTER_TIME_ZONE = 'America/New_York';
const BATCH_SIZE = 50;

export const siteUrl = (env: Env) => (env.SITE_URL || 'https://pawheaven.online').replace(/\/+$/, '');

async function unsubscribeLink(env: Env, email: string, scope: UnsubscribeScope): Promise<string> {
  const token = await signUnsubscribeToken(env, email, scope);
  return token ? `${siteUrl(env)}/unsubscribe?t=${encodeURIComponent(token)}` : `${siteUrl(env)}/me#details`;
}

// --- Layout ------------------------------------------------------------------------------------

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
const address = () => `${SHELTER.name}, ${SHELTER.address.line1}, ${SHELTER.address.city}, ${SHELTER.address.state} ${SHELTER.address.zip}`;

type Section = { heading?: string; html: string; text: string };

function bulkEmail(env: Env, input: { to: string; subject: string; heading: string; sections: Section[]; reason: string; unsubscribe: string; manage: string }): EmailMessage {
  const html = `<!doctype html><html><body style="margin:0;background:#f5f1e8;font-family:Arial,Helvetica,sans-serif;color:#1c1917">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #d6d3d1">
<tr><td style="padding:20px 28px;background:#3f5a36;color:#ffffff;font-size:18px;font-weight:bold">PawHeaven</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 16px;font-size:22px">${escapeHtml(input.heading)}</h1>
${input.sections.map((section) => `${section.heading ? `<h2 style="margin:22px 0 8px;font-size:17px">${escapeHtml(section.heading)}</h2>` : ''}${section.html}`).join('\n')}
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #e7e5e4;font-size:12px;line-height:1.6;color:#57534e">${escapeHtml(input.reason)}<br>
<a href="${escapeHtml(input.manage)}" style="color:#3f5a36">Manage your email choices</a> · <a href="${escapeHtml(input.unsubscribe)}" style="color:#3f5a36">Unsubscribe</a><br>${escapeHtml(address())}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [input.heading, '', ...input.sections.flatMap((section) => [section.heading ? `${section.heading}\n${'-'.repeat(section.heading.length)}` : '', section.text, '']),
    input.reason, `Manage your email choices: ${input.manage}`, `Unsubscribe: ${input.unsubscribe}`, address()].filter((line, index, all) => line !== '' || all[index - 1] !== '').join('\n');
  return { to: input.to, subject: input.subject, html, text, headers: { 'List-Unsubscribe': `<${input.unsubscribe}>` } };
}

const paragraphs = (body: string): Section => {
  const parts = body.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
  return { html: parts.map((part) => `<p style="margin:0 0 14px;line-height:1.6;font-size:15px">${escapeHtml(part).replace(/\n/g, '<br>')}</p>`).join('\n'), text: parts.join('\n\n') };
};

const link = (url: string, label: string) => `<a href="${escapeHtml(url)}" style="color:#3f5a36;font-weight:bold">${escapeHtml(label)}</a>`;

export function petSlugPath(pet: { id: string; name: string }): string {
  const name = pet.name.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'animal';
  return `/adopt/${name}-${pet.id.slice(0, 8)}`;
}

// --- Digests (new matches and saved-animal changes) ------------------------------------------------

export type OutboxRow = { id: string; kind: 'match' | 'saved_change' | 'newsletter'; email: string; member_id: string | null; payload: Record<string, unknown> };

const STATUS_WORDS: Record<string, string> = { Available: 'is available again', Pending: 'has an adoption in progress', Adopted: 'found a home' };

export async function digestEmail(env: Env, email: string, rows: OutboxRow[]): Promise<EmailMessage> {
  const site = siteUrl(env);
  const matches = new Map<string, string>();
  const changes = new Map<string, { name: string; status: string }>();
  for (const row of rows) {
    const id = String(row.payload.petId ?? '');
    const name = String(row.payload.petName ?? 'An animal');
    if (row.kind === 'match') matches.set(id, name);
    else changes.set(id, { name, status: String(row.payload.status ?? '') });
  }
  const sections: Section[] = [];
  if (matches.size) {
    const items = [...matches].map(([id, name]) => ({ name, url: `${site}${petSlugPath({ id, name })}` }));
    sections.push({
      heading: matches.size === 1 ? 'A new animal fits your saved search' : `${matches.size} new animals fit your saved searches`,
      html: `<ul style="margin:0 0 14px;padding-left:20px;line-height:1.8;font-size:15px">${items.map((item) => `<li>${link(item.url, item.name)}</li>`).join('')}</ul>`,
      text: items.map((item) => `- ${item.name}: ${item.url}`).join('\n'),
    });
  }
  if (changes.size) {
    const items = [...changes].map(([id, change]) => ({ ...change, url: `${site}${petSlugPath({ id, name: change.name })}` }));
    sections.push({
      heading: 'Animals you saved',
      html: `<ul style="margin:0 0 14px;padding-left:20px;line-height:1.8;font-size:15px">${items.map((item) => `<li>${link(item.url, item.name)} ${escapeHtml(STATUS_WORDS[item.status] ?? 'has an update')}</li>`).join('')}</ul>`,
      text: items.map((item) => `- ${item.name} ${STATUS_WORDS[item.status] ?? 'has an update'}: ${item.url}`).join('\n'),
    });
  }
  const subject = matches.size
    ? (matches.size === 1 ? 'A new animal fits your saved search' : `${matches.size} new animals fit your saved searches`)
    : 'Updates on animals you saved';
  return bulkEmail(env, {
    to: email, subject, heading: subject, sections,
    reason: 'You are receiving this daily summary because you saved a search or an animal on PawHeaven.',
    unsubscribe: await unsubscribeLink(env, email, 'alerts'), manage: `${site}/me#details`,
  });
}

// --- Newsletter -----------------------------------------------------------------------------------------

type NewsletterContent = Partial<Record<NewsletterBlock, Section>>;

const when = (startsAt: string, endsAt?: string) => {
  const start = new Date(startsAt);
  const date = new Intl.DateTimeFormat('en-US', { timeZone: SHELTER_TIME_ZONE, weekday: 'short', month: 'short', day: 'numeric' }).format(start);
  const time = endsAt
    ? new Intl.DateTimeFormat('en-US', { timeZone: SHELTER_TIME_ZONE, hour: 'numeric', minute: '2-digit' }).formatRange(start, new Date(endsAt))
    : new Intl.DateTimeFormat('en-US', { timeZone: SHELTER_TIME_ZONE, hour: 'numeric', minute: '2-digit' }).format(start);
  return `${date}, ${time}`;
};

/** Builds the auto-filled blocks an issue asks for. Uses the service role so the same code serves previews and the Worker job. */
export async function newsletterContent(env: Env, blocks: NewsletterBlock[]): Promise<NewsletterContent> {
  const admin = supabaseAdmin(env);
  const site = siteUrl(env);
  const content: NewsletterContent = {};
  if (!admin) return content;
  const petList = (rows: DatabasePet[], heading: string, withReason: boolean): Section | undefined => {
    if (!rows.length) return undefined;
    const pets = rows.map((row) => petForClient(row, env));
    return {
      heading,
      html: pets.map((pet) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px"><tr>${pet.imageUrl ? `<td width="96" valign="top"><a href="${escapeHtml(site + petSlugPath(pet))}"><img src="${escapeHtml(pet.imageUrl)}" alt="${escapeHtml(pet.name)}" width="88" height="88" style="display:block;object-fit:cover;border:0"></a></td>` : ''}<td valign="top" style="font-size:15px;line-height:1.5">${link(site + petSlugPath(pet), pet.name)}<br>${escapeHtml([pet.breed, pet.age].filter(Boolean).join(' · '))}${withReason && pet.helpReason ? `<br><strong>${escapeHtml(HELP_REASON_LABELS[pet.helpReason])}</strong>` : ''}</td></tr></table>`).join(''),
      text: pets.map((pet) => `- ${pet.name} (${[pet.breed, pet.age].filter(Boolean).join(', ')})${withReason && pet.helpReason ? ` – ${HELP_REASON_LABELS[pet.helpReason]}` : ''}: ${site}${petSlugPath(pet)}`).join('\n'),
    };
  };
  if (blocks.includes('help')) {
    const { data } = await admin.from('pets').select('*').eq('status', 'Available').neq('help_reason', '').order('help_since', { ascending: true }).limit(4);
    content.help = petList((data ?? []) as DatabasePet[], NEWSLETTER_BLOCK_LABELS.help, true);
  }
  if (blocks.includes('newest')) {
    const { data } = await admin.from('pets').select('*').eq('status', 'Available').order('intake_date', { ascending: false }).limit(4);
    content.newest = petList((data ?? []) as DatabasePet[], NEWSLETTER_BLOCK_LABELS.newest, false);
  }
  if (blocks.includes('events')) {
    const { data } = await admin.from('events').select('title, description, starts_at, ends_at').gt('starts_at', new Date().toISOString()).order('starts_at').limit(3);
    if (data?.length) content.events = {
      heading: NEWSLETTER_BLOCK_LABELS.events,
      html: `<ul style="margin:0 0 14px;padding-left:20px;line-height:1.7;font-size:15px">${data.map((event) => `<li><strong>${escapeHtml(event.title)}</strong><br>${escapeHtml(when(event.starts_at, event.ends_at))}</li>`).join('')}</ul><p style="margin:0 0 14px;font-size:15px">${link(`${site}/visit`, 'See visit times')}</p>`,
      text: `${data.map((event) => `- ${event.title}: ${when(event.starts_at, event.ends_at)}`).join('\n')}\nSee visit times: ${site}/visit`,
    };
  }
  if (blocks.includes('shifts')) {
    const { data } = await admin.from('volunteer_shifts').select('title, starts_at, ends_at').eq('status', 'published').gt('starts_at', new Date().toISOString()).order('starts_at').limit(4);
    if (data?.length) content.shifts = {
      heading: NEWSLETTER_BLOCK_LABELS.shifts,
      html: `<ul style="margin:0 0 14px;padding-left:20px;line-height:1.7;font-size:15px">${data.map((shift) => `<li><strong>${escapeHtml(shift.title)}</strong><br>${escapeHtml(when(shift.starts_at, shift.ends_at))}</li>`).join('')}</ul><p style="margin:0 0 14px;font-size:15px">${link(`${site}/volunteer`, 'Sign up to volunteer')}</p>`,
      text: `${data.map((shift) => `- ${shift.title}: ${when(shift.starts_at, shift.ends_at)}`).join('\n')}\nSign up to volunteer: ${site}/volunteer`,
    };
  }
  return content;
}

export async function newsletterEmail(env: Env, issue: Pick<Newsletter, 'subject' | 'body' | 'blocks'>, content: NewsletterContent, email: string): Promise<EmailMessage> {
  const blocks = issue.blocks.map((block) => content[block]).filter((section): section is Section => Boolean(section));
  return bulkEmail(env, {
    to: email, subject: issue.subject, heading: issue.subject, sections: [paragraphs(issue.body), ...blocks],
    reason: 'You are receiving this because you subscribed to PawHeaven adoption news.',
    unsubscribe: await unsubscribeLink(env, email, 'newsletter'), manage: `${siteUrl(env)}/me#details`,
  });
}

/** The double opt-in email sent right after a guest subscribes. */
export async function newsletterConfirmEmail(env: Env, email: string, token: string): Promise<EmailMessage> {
  const url = `${siteUrl(env)}/newsletter/confirm?t=${encodeURIComponent(token)}`;
  const heading = 'Confirm your subscription';
  const body = 'Thanks for signing up for PawHeaven adoption news. Choose the link below to confirm this address. If you did not ask for this, ignore this message and nothing will be sent.';
  return {
    to: email, subject: heading,
    text: `${heading}\n\n${body}\n\n${url}\n\n${address()}`,
    html: `<!doctype html><html><body style="margin:0;background:#f5f1e8;font-family:Arial,Helvetica,sans-serif;color:#1c1917"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px"><table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #d6d3d1"><tr><td style="padding:20px 28px;background:#3f5a36;color:#ffffff;font-size:18px;font-weight:bold">PawHeaven</td></tr><tr><td style="padding:28px"><h1 style="margin:0 0 16px;font-size:22px">${heading}</h1><p style="margin:0 0 14px;line-height:1.6;font-size:15px">${escapeHtml(body)}</p><p style="margin:0 0 14px;font-size:15px">${link(url, 'Confirm my subscription')}</p></td></tr><tr><td style="padding:16px 28px;border-top:1px solid #e7e5e4;font-size:12px;color:#57534e">${escapeHtml(address())}</td></tr></table></td></tr></table></body></html>`,
  };
}

// --- The queue ----------------------------------------------------------------------------------------------

/**
 * Sends every queued message that is due: one digest per person and one issue per subscriber, in
 * batches of 50. Failures are recorded and retried on later runs (three tries in all).
 */
export async function runOutbox(env: Env, limit = 200): Promise<{ claimed: number; sent: number; failed: number }> {
  const admin = supabaseAdmin(env);
  if (!admin) return { claimed: 0, sent: 0, failed: 0 };
  const claimed = await admin.rpc('claim_notifications', { p_limit: limit });
  if (claimed.error) {
    console.error(JSON.stringify({ operation: 'outbox.claim', error: claimed.error.message }));
    return { claimed: 0, sent: 0, failed: 0 };
  }
  const rows = (claimed.data ?? []) as OutboxRow[];
  const jobs: { message: EmailMessage; ids: string[] }[] = [];
  const failedIds: string[] = [];

  const digestRows = new Map<string, OutboxRow[]>();
  for (const row of rows.filter((item) => item.kind !== 'newsletter')) digestRows.set(row.email.toLowerCase(), [...(digestRows.get(row.email.toLowerCase()) ?? []), row]);
  for (const [email, group] of digestRows) jobs.push({ message: await digestEmail(env, email, group), ids: group.map((row) => row.id) });

  const issues = new Map<string, { issue: Newsletter | null; content: NewsletterContent }>();
  for (const row of rows.filter((item) => item.kind === 'newsletter')) {
    const issueId = String(row.payload.newsletterId ?? '');
    if (!issues.has(issueId)) {
      const { data } = await admin.from('newsletters').select('*').eq('id', issueId).maybeSingle();
      const issue = data ? { subject: data.subject, body: data.body, blocks: data.blocks } as Newsletter : null;
      issues.set(issueId, { issue, content: issue ? await newsletterContent(env, issue.blocks) : {} });
    }
    const entry = issues.get(issueId)!;
    if (!entry.issue) { failedIds.push(row.id); continue; }
    jobs.push({ message: await newsletterEmail(env, entry.issue, entry.content, row.email), ids: [row.id] });
  }

  let sent = 0;
  let failed = failedIds.length;
  if (failedIds.length) await admin.rpc('finish_notifications', { p_ids: failedIds, p_error: 'The newsletter no longer exists.' });
  for (let start = 0; start < jobs.length; start += BATCH_SIZE) {
    const chunk = jobs.slice(start, start + BATCH_SIZE);
    const ids = chunk.flatMap((job) => job.ids);
    const ok = await sendEmailBatch(env, chunk.map((job) => job.message));
    const finished = await admin.rpc('finish_notifications', ok ? { p_ids: ids } : { p_ids: ids, p_error: 'The email service did not accept the message.' });
    if (finished.error) console.error(JSON.stringify({ operation: 'outbox.finish', error: finished.error.message }));
    if (ok) sent += ids.length; else failed += ids.length;
  }
  console.info(JSON.stringify({ operation: 'outbox.run', claimed: rows.length, sent, failed }));
  return { claimed: rows.length, sent, failed };
}
