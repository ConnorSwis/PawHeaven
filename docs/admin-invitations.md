# Administrator invitations

A superuser invites an email address from the admin portal. The invitee opens the newest email, selects **Continue to set password**, chooses a password, and then signs in at `https://admin.pawheaven.online/login`. Invitations are single-use and expire according to Supabase Auth's email OTP expiration setting. A superuser can submit the same pending email again to send a replacement. Do not forward invitation links.

Superusers can also use **Resend setup email** beside an administrator who needs password setup. The resend uses Supabase's password-recovery flow because Supabase cannot create a second invite for an existing Auth user. It gives that administrator a fresh one-time link to choose their first password; the old email should be ignored. The portal marks **Password set** only after the shared acceptance page successfully saves a password; opening an email link alone does not complete setup.

## Expiration window

Supabase uses its **Email OTP expiration** setting for invitation, recovery, confirmation, and magic-link emails. In the Supabase dashboard, go to **Authentication → Sign In / Providers → Email**, then change **Email OTP expiration**. One day (`86400` seconds) is a practical upper limit for staff invitations; Supabase strongly discourages a duration longer than one day. This setting applies to every email-auth link in the project, not only administrator invitations.

The invite email directs the browser to `/accept-invite` with a one-time token hash in the URL fragment. The page removes the fragment from history and waits for an explicit click before sending the hash to the API for verification. This helps protect against email security scanners consuming a link before the recipient uses it. Supabase session-fragment links, including existing password-recovery emails, remain supported. Supabase recommends disabling email click tracking, which can rewrite auth links.

## Production rollout

1. Deploy the updated API and admin Workers first. The old Supabase invitation template continues to work until both are deployed.
2. In Supabase Auth URL Configuration, ensure `https://admin.pawheaven.online/accept-invite` is an allowed redirect. Production's missing entry was added on 2026-10-19. Keep the public site as the Site URL.
3. In Supabase Auth email templates, set the Invite user subject and HTML to the values in `supabase/config.toml` and `supabase/templates/admin-invite.html`. Apply only the invitation template; do not push the whole local Supabase config to production, because local auth and database settings differ.
4. Invite a test recipient and check that the email opens the admin page, the Continue button verifies it, and password setup and subsequent login work. Resend rather than reuse a consumed or expired link.

The template must be applied only after both Workers are live: older admin pages cannot interpret the new token-hash links. Changes to the Supabase template are not deployed automatically by the Workers build.
