interface Env {
  /** Cloudflare secret. Required for server-side Auth administration and first-superuser bootstrap. */
  ADMIN_SUPABASE_SERVICE_ROLE_KEY?: string;
  /** Non-secret, one-time bootstrap identity. Remove it after the first superuser has signed in. */
  BOOTSTRAP_SUPERUSER_EMAIL?: string;
  /** Supabase must allow this exact URL as an Auth redirect URL. */
  ADMIN_INVITE_REDIRECT_URL?: string;
  /** Cloudflare secret for transactional email through Resend. Without it, email is logged and not sent. */
  RESEND_API_KEY?: string;
  /** Sender shown on transactional email. The sending domain must be verified in Resend. */
  EMAIL_FROM?: string;
  /** Set to "true" in apps/api/.dev.vars to send real email from a local API. */
  EMAIL_LOCAL_DELIVERY?: string;
}
