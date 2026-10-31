import type { RouteContext } from './session';

export type EmailMessage = { to: string; subject: string; text: string; html: string; headers?: Record<string, string> };

const DEFAULT_FROM = 'PawHeaven <notifications@pawheaven.online>';
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/** In safe mode only Resend's test inboxes (@resend.dev) are allowed, so a demo can never email a real person. */
function blockedBySafeMode(env: Env, message: EmailMessage): boolean {
  return String(env.EMAIL_SAFE_MODE) === 'true' && !/@resend\.dev$/i.test(message.to);
}

/** True when messages should be logged instead of sent: local development, or no API key. */
function logOnly(env: Env): { skip: boolean; reason: string } {
  const local = String(env.DEPLOYMENT_TARGET) === 'local';
  if (!env.RESEND_API_KEY) return { skip: true, reason: 'RESEND_API_KEY is not configured' };
  if (local && env.EMAIL_LOCAL_DELIVERY !== 'true') return { skip: true, reason: 'local development' };
  return { skip: false, reason: '' };
}

function logNotSent(env: Env, message: EmailMessage, reason: string) {
  const local = String(env.DEPLOYMENT_TARGET) === 'local';
  console.info(JSON.stringify({
    operation: 'email.not_sent',
    reason,
    subject: message.subject,
    toDomain: message.to.split('@')[1] ?? '',
    ...(local ? { to: message.to, text: message.text } : {}),
  }));
}

const payloadFor = (env: Env, message: EmailMessage) => ({
  from: env.EMAIL_FROM || DEFAULT_FROM,
  to: [message.to],
  subject: message.subject,
  text: message.text,
  html: message.html,
  ...(message.headers ? { headers: message.headers } : {}),
});

/**
 * Delivers one email through Resend. It never throws: email is a courtesy, and a mail outage must
 * not undo a booking or review. Returns true when the message was sent or deliberately skipped
 * (local development, safe mode) and false when delivery failed, so the outbox can retry.
 *
 * Local development logs the message instead of sending it, because seeded
 * accounts use unreachable addresses. Set EMAIL_LOCAL_DELIVERY=true in
 * .dev.vars to exercise real delivery from a local API.
 */
export async function sendEmail(env: Env, message: EmailMessage): Promise<boolean> {
  if (blockedBySafeMode(env, message)) { logNotSent(env, message, 'safe mode allows only @resend.dev'); return true; }
  const mode = logOnly(env);
  if (mode.skip) { logNotSent(env, message, mode.reason); return !env.RESEND_API_KEY ? String(env.DEPLOYMENT_TARGET) === 'local' : true; }
  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadFor(env, message)),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      console.error(JSON.stringify({ operation: 'email.send', status: response.status, detail: (await response.text().catch(() => '')).slice(0, 300) }));
      return false;
    }
    console.info(JSON.stringify({ operation: 'email.send', subject: message.subject, toDomain: message.to.split('@')[1] ?? '' }));
    return true;
  } catch (error) {
    console.error(JSON.stringify({ operation: 'email.send', error: error instanceof Error ? error.message : 'Unknown error' }));
    return false;
  }
}

/** Sends many messages with one request to Resend's batch endpoint (up to 100). All or nothing: false means retry them all. */
export async function sendEmailBatch(env: Env, messages: EmailMessage[]): Promise<boolean> {
  const allowed = messages.filter((message) => {
    if (!blockedBySafeMode(env, message)) return true;
    logNotSent(env, message, 'safe mode allows only @resend.dev');
    return false;
  });
  if (!allowed.length) return true;
  const mode = logOnly(env);
  if (mode.skip) {
    for (const message of allowed) logNotSent(env, message, mode.reason);
    return Boolean(env.RESEND_API_KEY) || String(env.DEPLOYMENT_TARGET) === 'local';
  }
  try {
    const response = await fetch(`${RESEND_ENDPOINT}/batch`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(allowed.slice(0, 100).map((message) => payloadFor(env, message))),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) {
      console.error(JSON.stringify({ operation: 'email.batch', status: response.status, detail: (await response.text().catch(() => '')).slice(0, 300) }));
      return false;
    }
    console.info(JSON.stringify({ operation: 'email.batch', count: Math.min(allowed.length, 100) }));
    return true;
  } catch (error) {
    console.error(JSON.stringify({ operation: 'email.batch', error: error instanceof Error ? error.message : 'Unknown error' }));
    return false;
  }
}

/** Sends after the response has been returned so the visitor never waits on the mail provider. */
export function notify(context: Pick<RouteContext, 'env' | 'ctx'>, message: EmailMessage): void {
  context.ctx.waitUntil(sendEmail(context.env, message));
}
