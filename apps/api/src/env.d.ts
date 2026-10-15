interface Env {
  /** Cloudflare secret. Required only for administrator invitations and first-superuser bootstrap. */
  ADMIN_SUPABASE_SERVICE_ROLE_KEY?: string;
  /** Non-secret, one-time bootstrap identity. Remove it after the first superuser has signed in. */
  BOOTSTRAP_SUPERUSER_EMAIL?: string;
  /** Supabase must allow this exact URL as an Auth redirect URL. */
  ADMIN_INVITE_REDIRECT_URL?: string;
}
