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
  /** Cloudflare secret for AI matching through OpenRouter. Without it, the quiz and lost-pet search report that matching is unavailable. */
  OPENROUTER_API_KEY?: string;
  /** Optional OpenRouter model id for the pet-matching quiz. */
  OPENROUTER_QUIZ_MODEL?: string;
  /** Optional OpenRouter model id for lost-pet photo comparison. Must accept images. */
  OPENROUTER_VISION_MODEL?: string;
  /** Optional address that is emailed when a lost-pet inquiry arrives. Staff always see inquiries in the portal. */
  SHELTER_NOTIFICATION_EMAIL?: string;
  /** Cloudflare secret (`whsec_...`) that verifies Stripe webhook signatures. Without it donations are not recorded. */
  STRIPE_WEBHOOK_SECRET?: string;
  /** Public address of the website, used for links in email. Defaults to https://pawheaven.online. */
  SITE_URL?: string;
  /** Cloudflare secret that signs unsubscribe links. Defaults to the service-role key, so it only needs setting to rotate links on their own. */
  UNSUBSCRIBE_SECRET?: string;
  /** Set to "true" to send only to @resend.dev addresses (Resend's test inboxes), so a demo can never email a real person. */
  EMAIL_SAFE_MODE?: string;
}
