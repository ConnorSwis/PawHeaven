-- Administrator roles remain immutable Auth app_metadata. This table is an
-- internal audit record for invitations sent by a superuser through the API.
create table public.admin_invitation_audit (
  id uuid primary key default gen_random_uuid(),
  invited_email text not null check (char_length(invited_email) between 3 and 254),
  invited_user_id uuid references auth.users(id) on delete set null,
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now()
);

create index admin_invitation_audit_invited_at_idx on public.admin_invitation_audit (invited_at desc);

alter table public.admin_invitation_audit enable row level security;
revoke all on public.admin_invitation_audit from anon, authenticated;

comment on table public.admin_invitation_audit is
  'Invitation audit trail. Only the server-side Supabase service-role client may write or read it.';
