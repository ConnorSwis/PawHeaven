alter table public.admin_invitation_audit
  add column password_set_at timestamptz;

comment on column public.admin_invitation_audit.password_set_at is
  'Set by the API after an invited administrator successfully saves their first password.';
