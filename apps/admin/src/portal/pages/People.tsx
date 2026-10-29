import { useMemo, useState } from 'react';
import type { AdminInvitation, AdminInvitationListResponse, AdminUserDetailResponse, AdminUserListResponse, ManagedUser } from '@pawheaven/contracts';
import { api, errorMessage, useApi, useRefresh } from '../lib/api';
import { ago, formatDate } from '../lib/format';
import { useRoute } from '../lib/router';
import type { PageProps } from '../routes';
import { Badge, Button, type Column, ConfirmDialog, DataTable, Detail, EmptyState, Field, FilterSelect, Input, PageHeader, SearchBox, Select, Sheet, StatusBadge, Tabs, Toolbar } from '../ui';
import { useToast } from '../ui/toast';

const roleLabel = (role: ManagedUser['role']) => (role === 'superuser' ? 'Superuser' : role === 'staff' ? 'Staff' : 'Member');
const roleTone = (role: ManagedUser['role']) => (role === 'superuser' ? 'warn' : role === 'staff' ? 'good' : 'neutral') as 'warn' | 'good' | 'neutral';

function accountState(user: ManagedUser) {
  if (user.blocked) return 'Blocked';
  if (!user.emailConfirmedAt) return 'Unconfirmed';
  return 'Active';
}

function UserPanel({ id, me, onClose }: { id: string; me: PageProps['user']; onClose: () => void }) {
  const detail = useApi<AdminUserDetailResponse>(`/admin/users/${encodeURIComponent(id)}`);
  const refresh = useRefresh();
  const toast = useToast();
  const user = detail.data?.user;
  const [name, setName] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'delete' | 'block' | null>(null);
  const [busy, setBusy] = useState(false);

  const canManage = Boolean(user && user.id !== me.id && user.role !== 'superuser' && (user.role !== 'staff' || me.role === 'superuser'));
  const run = async (label: string, work: () => Promise<unknown>) => {
    setBusy(true);
    try { await work(); toast.success(label); await refresh('/admin/users'); } catch (error) { toast.error(errorMessage(error)); } finally { setBusy(false); }
  };

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }} title={user?.name ?? 'Account'} description={user ? `${user.email} · ${roleLabel(user.role)}` : 'Loading account…'}
      footer={user && canManage ? (
        <>
          <Button variant="danger" onClick={() => setConfirm('delete')}>Delete account</Button>
          <span className="flex-1" />
          <Button onClick={() => (user.blocked ? run('Sign-in restored.', () => api(`/admin/users/${user.id}/access`, { method: 'PUT', json: { blocked: false } })) : setConfirm('block'))} disabled={busy}>{user.blocked ? 'Restore sign-in' : 'Block sign-in'}</Button>
        </>
      ) : undefined}>
      {detail.isLoading && <p className="text-sm text-stone-700">Loading…</p>}
      {detail.isError && <p className="text-sm text-red-800" role="alert">{errorMessage(detail.error, 'This account could not be loaded.')}</p>}
      {user && (
        <div className="grid gap-6">
          <dl className="grid grid-cols-2 gap-4">
            <Detail label="Status"><StatusBadge status={accountState(user)} /></Detail>
            <Detail label="Role"><Badge tone={roleTone(user.role)}>{roleLabel(user.role)}</Badge></Detail>
            <Detail label="Joined">{formatDate(user.createdAt)}</Detail>
            <Detail label="Last signed in">{user.lastSignInAt ? ago(user.lastSignInAt) : 'Never'}</Detail>
          </dl>

          <form className="grid gap-3 border-t border-stone-200 pt-5" onSubmit={(event) => { event.preventDefault(); void run('Account saved.', () => api(`/admin/users/${user.id}`, { method: 'PUT', json: { name: (name ?? user.name).trim(), email: (email ?? user.email).trim() } })); }}>
            <h3 className="text-sm font-semibold text-stone-950">Account information</h3>
            <Field label="Name"><Input value={name ?? user.name} onChange={(event) => setName(event.target.value)} disabled={!canManage} required maxLength={100} /></Field>
            <Field label="Email" help="Changing it signs them in with the new address."><Input type="email" value={email ?? user.email} onChange={(event) => setEmail(event.target.value)} disabled={!canManage} required /></Field>
            {canManage && <Button type="submit" variant="primary" className="justify-self-start" disabled={busy}>Save</Button>}
          </form>

          {canManage && me.role === 'superuser' && user.role !== 'superuser' && (
            <form className="grid gap-3 border-t border-stone-200 pt-5" onSubmit={(event) => { event.preventDefault(); void run('Role changed. It takes effect the next time they use the site.', () => api(`/admin/users/${user.id}/role`, { method: 'PUT', json: { role: role ?? user.role } })); }}>
              <h3 className="text-sm font-semibold text-stone-950">Staff access</h3>
              <Field label="Role"><Select value={role ?? user.role} onChange={(event) => setRole(event.target.value)}><option value="member">Member</option><option value="staff">Staff</option></Select></Field>
              <Button type="submit" className="justify-self-start" disabled={busy || (role ?? user.role) === user.role}>Change role</Button>
            </form>
          )}

          <div className="border-t border-stone-200 pt-5">
            <h3 className="text-sm font-semibold text-stone-950">Sign-in help</h3>
            <p className="mt-1 text-sm text-stone-700">Sends the member an email with a link to choose a new password.</p>
            <Button className="mt-3" disabled={busy || !canManage} onClick={() => void run('Password reset email sent.', () => api(`/admin/users/${user.id}/password-reset`, { method: 'POST' }))}>Send password reset</Button>
          </div>

          <div className="border-t border-stone-200 pt-5">
            <h3 className="text-sm font-semibold text-stone-950">Adoption applications ({detail.data?.applications.length ?? 0})</h3>
            {detail.data?.applications.length ? (
              <ul className="mt-2 grid gap-2">
                {detail.data.applications.map((application) => (
                  <li key={application.id} className="flex items-center justify-between gap-3 border border-stone-200 px-3 py-2 text-sm"><span>{application.petName}<span className="text-stone-600"> · {formatDate(application.submittedAt)}</span></span><StatusBadge status={application.status} /></li>
                ))}
              </ul>
            ) : <p className="mt-1 text-sm text-stone-700">No applications.</p>}
          </div>

          <ConfirmDialog open={confirm === 'delete'} danger title="Delete this account?" confirmLabel="Delete account" onCancel={() => setConfirm(null)}
            description={<>This permanently deletes <strong>{user.email}</strong> and their saved details, visits, and volunteer sign-ups. Applications are kept only if the database requires it. This cannot be undone.</>}
            onConfirm={async () => { await run('Account deleted.', () => api(`/admin/users/${user.id}`, { method: 'DELETE' })); setConfirm(null); onClose(); }} />
          <ConfirmDialog open={confirm === 'block'} title="Block sign-in?" confirmLabel="Block sign-in" onCancel={() => setConfirm(null)}
            description={<><strong>{user.email}</strong> will not be able to sign in until you restore access. Nothing is deleted.</>}
            onConfirm={async () => { await run('Sign-in blocked.', () => api(`/admin/users/${user.id}/access`, { method: 'PUT', json: { blocked: true } })); setConfirm(null); }} />
        </div>
      )}
    </Sheet>
  );
}

function StaffTab({ me, users }: { me: PageProps['user']; users: ManagedUser[] }) {
  const invitations = useApi<AdminInvitationListResponse>('/admin/invitations', { enabled: me.role === 'superuser' });
  const refresh = useRefresh();
  const toast = useToast();
  const { setParams } = useRoute();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const staff = users.filter((user) => user.role !== 'member');

  const invite = async () => {
    setBusy(true);
    try { await api('/admin/invitations', { method: 'POST', json: { email: email.trim() } }); toast.success(`Invitation sent to ${email.trim()}.`); setEmail(''); await refresh('/admin/invitations', '/admin/users'); } catch (error) { toast.error(errorMessage(error)); } finally { setBusy(false); }
  };
  const resend = async (item: AdminInvitation) => {
    try { await api(`/admin/invitations/${item.userId}/resend`, { method: 'POST' }); toast.success(`Invitation resent to ${item.email}.`); await refresh('/admin/invitations'); } catch (error) { toast.error(errorMessage(error)); }
  };

  const columns: Column<ManagedUser>[] = [
    { key: 'name', header: 'Name', sort: (row) => row.name.toLowerCase(), cell: (row) => <div><p className="font-medium text-stone-950">{row.name}</p><p className="text-xs text-stone-600">{row.email}</p></div> },
    { key: 'role', header: 'Role', cell: (row) => <Badge tone={roleTone(row.role)}>{roleLabel(row.role)}</Badge> },
    { key: 'last', header: 'Last signed in', hideBelow: 'sm', cell: (row) => (row.lastSignInAt ? ago(row.lastSignInAt) : 'Never') },
  ];
  return (
    <div className="mt-5 grid gap-6">
      <DataTable rows={staff} columns={columns} rowId={(row) => row.id} onRowClick={(row) => setParams({ id: row.id })} empty={<EmptyState title="No staff yet" />} />
      {me.role === 'superuser' ? (
        <div className="grid items-start gap-6 lg:grid-cols-2">
          <form className="grid gap-3 border border-stone-300 bg-white p-5" onSubmit={(event) => { event.preventDefault(); void invite(); }}>
            <h3 className="text-base font-semibold text-stone-950">Invite a staff member</h3>
            <p className="text-sm text-stone-700">They get an email to choose a password before their first sign-in.</p>
            <Field label="Email address"><Input type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" /></Field>
            <Button type="submit" variant="primary" className="justify-self-start" disabled={busy || !email.trim()}>Send invitation</Button>
          </form>
          <div className="border border-stone-300 bg-white p-5">
            <h3 className="text-base font-semibold text-stone-950">Invitations</h3>
            {!invitations.data?.invitations.length ? <p className="mt-2 text-sm text-stone-700">No invitations have been sent.</p> : (
              <ul className="mt-3 grid gap-2">
                {invitations.data.invitations.map((item) => (
                  <li key={item.userId} className="flex flex-wrap items-center justify-between gap-2 border border-stone-200 px-3 py-2 text-sm">
                    <span className="min-w-0"><span className="block truncate">{item.email}</span><span className="text-xs text-stone-600">Invited {formatDate(item.invitedAt)}</span></span>
                    <span className="flex items-center gap-2"><StatusBadge status={item.status} label={item.status === 'active' ? 'Active' : 'Waiting for setup'} />{item.status === 'awaiting_setup' && <Button size="sm" onClick={() => void resend(item)}>Resend</Button>}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : <p className="text-sm text-stone-700">Only a superuser can invite staff and change roles.</p>}
    </div>
  );
}

export default function People({ user: me }: PageProps) {
  const { params, setParams } = useRoute();
  const list = useApi<AdminUserListResponse>('/admin/users');
  const [search, setSearch] = useState('');
  const tab = params.get('tab') === 'staff' ? 'staff' : 'accounts';
  const role = params.get('role') ?? '';
  const status = params.get('status') ?? '';
  const selectedId = params.get('id');

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return (list.data?.users ?? []).filter((user) => (!needle || `${user.name} ${user.email}`.toLowerCase().includes(needle)) && (!role || user.role === role) && (!status || accountState(user) === status));
  }, [list.data, search, role, status]);

  const columns: Column<ManagedUser>[] = [
    { key: 'name', header: 'Name', sort: (row) => row.name.toLowerCase(), cell: (row) => <div className="min-w-0"><p className="font-medium text-stone-950">{row.name}</p><p className="truncate text-xs text-stone-600">{row.email}</p></div> },
    { key: 'role', header: 'Role', sort: (row) => row.role, cell: (row) => <Badge tone={roleTone(row.role)}>{roleLabel(row.role)}</Badge> },
    { key: 'status', header: 'Status', hideBelow: 'sm', cell: (row) => <StatusBadge status={accountState(row)} /> },
    { key: 'last', header: 'Last signed in', hideBelow: 'md', sort: (row) => row.lastSignInAt ?? '', cell: (row) => (row.lastSignInAt ? ago(row.lastSignInAt) : 'Never') },
    { key: 'joined', header: 'Joined', hideBelow: 'lg', sort: (row) => row.createdAt, cell: (row) => formatDate(row.createdAt) },
  ];

  return (
    <div>
      <PageHeader title="People" description="Member and staff accounts. Click a row to see details, send a password reset, or block sign-in." />
      <div className="mt-5"><Tabs value={tab} onChange={(next) => setParams({ tab: next === 'staff' ? 'staff' : null, id: null })} items={[{ id: 'accounts', label: 'Accounts', count: list.data?.users.length }, { id: 'staff', label: 'Staff and invitations' }]} /></div>
      {tab === 'accounts' ? (
        <>
          <Toolbar>
            <SearchBox value={search} onChange={setSearch} placeholder="Search name or email" />
            <FilterSelect label="Role" value={role} onChange={(value) => setParams({ role: value })} options={[{ value: 'member', label: 'Members' }, { value: 'staff', label: 'Staff' }, { value: 'superuser', label: 'Superusers' }]} />
            <FilterSelect label="Status" value={status} onChange={(value) => setParams({ status: value })} options={[{ value: 'Active', label: 'Active' }, { value: 'Blocked', label: 'Blocked' }, { value: 'Unconfirmed', label: 'Unconfirmed' }]} />
            <span className="text-sm text-stone-600">{rows.length} of {list.data?.users.length ?? 0}</span>
          </Toolbar>
          <div className="mt-3"><DataTable rows={rows} columns={columns} rowId={(row) => row.id} loading={list.isLoading} error={list.isError ? errorMessage(list.error, 'Accounts could not be loaded.') : null} selectedId={selectedId} onRowClick={(row) => setParams({ id: row.id })} initialSort={{ key: 'name', dir: 'asc' }} empty={<EmptyState title="No accounts match">Try a different search or clear the filters.</EmptyState>} /></div>
        </>
      ) : <StaffTab me={me} users={list.data?.users ?? []} />}
      {selectedId && <UserPanel id={selectedId} me={me} onClose={() => setParams({ id: null })} />}
    </div>
  );
}
