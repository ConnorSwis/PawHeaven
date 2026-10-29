import { sendEmail } from './lib/email';
import { reminderEmail } from './lib/email-templates';
import { supabaseAdmin } from './lib/supabase';

/**
 * Runs hourly from the Worker's cron trigger. Keeps open hours generated weeks ahead and emails
 * reminders for visits and shifts starting within a day. Needs the service-role secret.
 */
export async function runScheduledJobs(env: Env): Promise<void> {
  const admin = supabaseAdmin(env);
  if (!admin) {
    console.error(JSON.stringify({ operation: 'scheduled', error: 'service role is not configured' }));
    return;
  }

  const generated = await admin.rpc('generate_availability');
  if (generated.error) console.error(JSON.stringify({ operation: 'scheduled.generate', error: generated.error.message }));

  const reminders = await admin.rpc('claim_due_reminders');
  if (reminders.error) {
    console.error(JSON.stringify({ operation: 'scheduled.reminders', error: reminders.error.message }));
    return;
  }
  const due = reminders.data as { kind: 'visit' | 'shift'; member_name: string; member_email: string; title: string; starts_at: string; ends_at: string; detail: string }[];
  for (const reminder of due) {
    await sendEmail(env, reminderEmail({ to: reminder.member_email, name: reminder.member_name, kind: reminder.kind, title: reminder.title, startsAt: reminder.starts_at, endsAt: reminder.ends_at, detail: reminder.detail }));
  }
  console.info(JSON.stringify({ operation: 'scheduled.done', reminders: due.length }));
}
