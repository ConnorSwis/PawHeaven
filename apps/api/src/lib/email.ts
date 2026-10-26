import type { RouteContext } from './session';

export type EmailMessage = { to: string; subject: string; text: string; html: string };

const DEFAULT_FROM = 'PawHeaven <notifications@pawheaven.online>';
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

/**
 * Delivers one transactional email through Resend. It never throws: email is a
 * courtesy confirmation, and a mail outage must not undo a booking or review.
 *
 * Local development logs the message instead of sending it, because seeded
 * accounts use unreachable addresses. Set EMAIL_LOCAL_DELIVERY=true in
 * .dev.vars to exercise real delivery from a local API.
 */
export async function sendEmail(env: Env, message: EmailMessage): Promise<void> {
  const local = String(env.DEPLOYMENT_TARGET) === 'local';
  if (!env.RESEND_API_KEY || (local && env.EMAIL_LOCAL_DELIVERY !== 'true')) {
    console.info(JSON.stringify({
      operation: 'email.not_sent',
      reason: env.RESEND_API_KEY ? 'local development' : 'RESEND_API_KEY is not configured',
      subject: message.subject,
      toDomain: message.to.split('@')[1] ?? '',
      ...(local ? { to: message.to, text: message.text } : {}),
    }));
    return;
  }
  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: env.EMAIL_FROM || DEFAULT_FROM,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      console.error(JSON.stringify({ operation: 'email.send', status: response.status, detail: (await response.text().catch(() => '')).slice(0, 300) }));
      return;
    }
    console.info(JSON.stringify({ operation: 'email.send', subject: message.subject, toDomain: message.to.split('@')[1] ?? '' }));
  } catch (error) {
    console.error(JSON.stringify({ operation: 'email.send', error: error instanceof Error ? error.message : 'Unknown error' }));
  }
}

/** Sends after the response has been returned so the visitor never waits on the mail provider. */
export function notify(context: Pick<RouteContext, 'env' | 'ctx'>, message: EmailMessage): void {
  context.ctx.waitUntil(sendEmail(context.env, message));
}
