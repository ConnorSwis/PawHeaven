import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { NEWSLETTER_BLOCKS, NEWSLETTER_BLOCK_LABELS, type Newsletter, type NewsletterBlock, type NewsletterListResponse, type NewsletterPreviewResponse, type NewsletterStatus, type OutreachSummary } from '@pawheaven/contracts';
import { ApiRequestError, api, errorMessage, useApi, useRefresh } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { useRoute } from '../../lib/router';
import { PlusIcon } from '../../ui/icons';
import { Badge, Button, ConfirmDialog, type Column, DataTable, EmptyState, ErrorSummary, Field, Input, Notice, Sheet, Textarea, cx } from '../../ui';
import { useToast } from '../../ui/toast';

const STATUS_LABEL: Record<NewsletterStatus, string> = { draft: 'Draft', sending: 'Sending…', sent: 'Sent' };
const STATUS_TONE: Record<NewsletterStatus, 'neutral' | 'warn' | 'good'> = { draft: 'neutral', sending: 'warn', sent: 'good' };
const people = (count: number) => `${count} ${count === 1 ? 'person' : 'people'}`;
const FIELD_IDS = { subject: 'issue-subject', body: 'issue-body', blocks: 'issue-block-help' } as const;

/** Makes links in the preview open nowhere: the frame is sandboxed, and a link must never load a page inside it. */
const previewDocument = (html: string) => (/<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, (head) => `${head}<base target="_blank">`) : `<base target="_blank">${html}`);

function EmailPreview({ preview, loading }: { preview: NewsletterPreviewResponse | null; loading: boolean }) {
  const [phone, setPhone] = useState(false);
  if (!preview && !loading) return null;
  return (
    <section aria-label="Preview" className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-stone-950">Preview{preview ? `: ${preview.subject}` : ''}</h3>
        <div role="group" aria-label="Preview width" className="flex gap-1">
          <Button size="sm" className="min-h-11" variant={phone ? 'secondary' : 'primary'} aria-pressed={!phone} onClick={() => setPhone(false)}>Wide</Button>
          <Button size="sm" className="min-h-11" variant={phone ? 'primary' : 'secondary'} aria-pressed={phone} onClick={() => setPhone(true)}>Phone</Button>
        </div>
      </div>
      {loading && !preview && <p className="text-sm text-stone-700" role="status">Loading the preview…</p>}
      {preview && (
        <div className="overflow-x-auto border border-stone-300 bg-stone-100 p-2">
          {/* No scripts and no same-origin access: the email can show but never act. Links are inert here. */}
          <iframe title="Email preview" sandbox="" referrerPolicy="no-referrer" srcDoc={previewDocument(preview.html)} className={cx('mx-auto block h-[28rem] max-h-[60vh] w-full border-0 bg-white', phone && 'max-w-[375px]')} />
        </div>
      )}
      <p className="text-xs leading-5 text-stone-600">This is how the email looks to a subscriber. Links do not open from the preview.</p>
    </section>
  );
}

function IssueSheet({ initial, onClose, onCreated, confirmed }: { initial: Newsletter | null; onClose: () => void; onCreated: (id: string) => void; confirmed: number | undefined }) {
  const refresh = useRefresh();
  const toast = useToast();
  const [issue, setIssue] = useState<Newsletter | null>(initial);
  const [subject, setSubject] = useState(initial?.subject ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [blocks, setBlocks] = useState<NewsletterBlock[]>(initial?.blocks ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [focusSignal, setFocusSignal] = useState(0);
  const [busy, setBusy] = useState<null | 'save' | 'preview' | 'test' | 'send' | 'delete'>(null);
  const [status, setStatus] = useState('');
  const [preview, setPreview] = useState<NewsletterPreviewResponse | null>(null);
  const [confirm, setConfirmState] = useState<'send' | 'delete' | null>(null);
  // A ref as well as state: the sheet must know a confirm is opening before React has re-rendered, or the focus move closes the sheet.
  const confirmOpen = useRef(false);
  const setConfirm = (next: 'send' | 'delete' | null) => { confirmOpen.current = next !== null; setConfirmState(next); };

  const readOnly = Boolean(issue && issue.status !== 'draft');
  const dirty = !issue || issue.subject !== subject.trim() || issue.body !== body || issue.blocks.length !== blocks.length || issue.blocks.some((block) => !blocks.includes(block));
  const errorList = (Object.keys(FIELD_IDS) as (keyof typeof FIELD_IDS)[]).filter((key) => errors[key]).map((key) => ({ id: FIELD_IDS[key], message: errors[key] }));
  const edit = (change: () => void) => { change(); setPreview(null); setStatus(''); };

  /** Creates or updates the draft. Returns the saved issue, or null when the server rejected a field. */
  const save = async (): Promise<Newsletter | null> => {
    if (!dirty && issue) return issue;
    setErrors({});
    try {
      const input = { subject: subject.trim(), body, blocks };
      const saved = issue ? await api<Newsletter>(`/admin/newsletters/${issue.id}`, { method: 'PUT', json: input }) : await api<Newsletter>('/admin/newsletters', { method: 'POST', json: input });
      if (!issue) onCreated(saved.id);
      setIssue(saved); setSubject(saved.subject); setBody(saved.body); setBlocks(saved.blocks);
      await refresh('/admin/newsletters');
      return saved;
    } catch (error) {
      if (error instanceof ApiRequestError && error.fieldErrors) { setErrors(error.fieldErrors); setFocusSignal((value) => value + 1); setStatus('This draft was not saved. Fix the problems listed above.'); }
      else { toast.error(errorMessage(error)); setStatus(`Not saved. ${errorMessage(error)}`); }
      return null;
    }
  };

  const run = async (name: NonNullable<typeof busy>, action: () => Promise<void>) => { setBusy(name); try { await action(); } finally { setBusy(null); } };

  const onSave = () => run('save', async () => { const saved = await save(); if (saved) setStatus('Draft saved.'); });
  const loadPreview = async (saved: Newsletter) => {
    try { setPreview(await api<NewsletterPreviewResponse>(`/admin/newsletters/${saved.id}/preview`)); setStatus(''); }
    catch (error) { setStatus(`The preview could not be loaded. ${errorMessage(error)}`); }
  };
  const onPreview = () => run('preview', async () => { const saved = readOnly ? issue : await save(); if (saved) await loadPreview(saved); });
  const onTest = () => run('test', async () => {
    const saved = await save();
    if (!saved) return;
    try { const result = await api<{ sentTo: string }>(`/admin/newsletters/${saved.id}/test`, { method: 'POST' }); setStatus(`A test copy was sent to ${result.sentTo}.`); }
    catch (error) { setStatus(`The test could not be sent. ${errorMessage(error)}`); }
  });
  const onAskSend = () => run('send', async () => { if (await save()) setConfirm('send'); });

  const send = async () => {
    if (!issue) return;
    try {
      const result = await api<{ queued: number }>(`/admin/newsletters/${issue.id}/send`, { method: 'POST' });
      toast.success(`Queued for ${people(result.queued)}`);
      await refresh('/admin/newsletters', '/admin/outreach', '/admin/attention');
      setConfirm(null);
      onClose();
    } catch (error) { setConfirm(null); setStatus(`Not sent. ${errorMessage(error)}`); toast.error(errorMessage(error)); }
  };
  const remove = async () => {
    if (!issue) return;
    try {
      await api(`/admin/newsletters/${issue.id}`, { method: 'DELETE' });
      await refresh('/admin/newsletters');
      toast.success('The draft was deleted.');
      setConfirm(null);
      onClose();
    } catch (error) { setConfirm(null); toast.error(errorMessage(error)); }
  };

  const title = !issue ? 'New issue' : readOnly ? issue.subject : 'Edit draft';
  const footer = readOnly ? <Button onClick={onClose}>Close</Button> : (
    <>
      <p role="status" aria-live="polite" className="mr-auto min-w-0 flex-1 basis-full text-sm text-stone-800 sm:basis-auto">{status}</p>
      {issue && <Button variant="danger" className="min-h-11" disabled={busy !== null} onClick={() => setConfirm('delete')}>Delete draft</Button>}
      <Button className="min-h-11" disabled={busy !== null} onClick={() => void onSave()}>{busy === 'save' ? 'Saving…' : 'Save draft'}</Button>
      <Button className="min-h-11" disabled={busy !== null} onClick={() => void onTest()}>{busy === 'test' ? 'Sending…' : 'Send me a test'}</Button>
      <Button variant="primary" className="min-h-11" disabled={busy !== null || confirmed === 0} onClick={() => void onAskSend()}>{confirmed === undefined ? 'Send…' : `Send to ${people(confirmed)}…`}</Button>
    </>
  );

  return (
    <>
      <Sheet open onOpenChange={(open) => { if (!open && !confirmOpen.current) onClose(); }} width="max-w-2xl" title={title}
        description={readOnly ? `${issue?.status === 'sending' ? 'Sending' : 'Sent'}${issue?.sentAt ? ` ${formatDate(issue.sentAt)}` : ''} to ${people(issue?.recipientCount ?? 0)}. A sent issue cannot be changed.` : 'Write the issue, preview it, send yourself a test, then send it to everyone.'} footer={footer}>
        {readOnly && issue ? (
          <div className="grid gap-5">
            <dl className="grid gap-4">
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-stone-600">Subject</dt><dd className="mt-0.5 text-sm text-stone-900">{issue.subject}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-stone-600">Message</dt><dd className="mt-0.5 whitespace-pre-wrap break-words text-sm text-stone-900">{issue.body || <span className="text-stone-600">No message</span>}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-stone-600">Sections</dt><dd className="mt-0.5 text-sm text-stone-900">{issue.blocks.length ? issue.blocks.map((block) => NEWSLETTER_BLOCK_LABELS[block]).join(', ') : 'None'}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wide text-stone-600">Recipients</dt><dd className="mt-0.5 text-sm text-stone-900">{issue.status === 'sending' ? `Sending to ${people(issue.recipientCount)}…` : people(issue.recipientCount)}</dd></div>
            </dl>
            <div><Button className="min-h-11" disabled={busy !== null} onClick={() => void onPreview()}>{busy === 'preview' ? 'Loading…' : preview ? 'Reload preview' : 'Preview'}</Button></div>
            <p role="status" aria-live="polite" className="text-sm text-stone-800">{status}</p>
            <EmailPreview preview={preview} loading={busy === 'preview'} />
          </div>
        ) : (
          <form className="grid gap-5" noValidate onSubmit={(event) => { event.preventDefault(); void onSave(); }}>
            <ErrorSummary errors={errorList} focusSignal={focusSignal} />
            {confirmed === 0 && <Notice title="No confirmed subscribers yet">You can save drafts and send yourself a test, but there is no one to send an issue to until someone confirms their subscription.</Notice>}
            <Field label="Subject" error={errors.subject}><Input id={FIELD_IDS.subject} value={subject} maxLength={200} aria-invalid={Boolean(errors.subject)} onChange={(event) => edit(() => setSubject(event.target.value))} /></Field>
            <Field label="Message" error={errors.body} help="Separate paragraphs with a blank line."><Textarea id={FIELD_IDS.body} rows={9} value={body} aria-invalid={Boolean(errors.body)} onChange={(event) => edit(() => setBody(event.target.value))} /></Field>
            <fieldset className="grid gap-2">
              <legend className="mb-1 text-sm font-medium text-stone-900">Sections to include</legend>
              {NEWSLETTER_BLOCKS.map((block) => (
                <label key={block} className="flex min-h-11 items-center gap-3 text-sm text-stone-900"><input type="checkbox" id={`issue-block-${block}`} className="size-5" checked={blocks.includes(block)} onChange={(event) => edit(() => setBlocks((current) => (event.target.checked ? NEWSLETTER_BLOCKS.filter((item) => item === block || current.includes(item)) : current.filter((item) => item !== block))))} />{NEWSLETTER_BLOCK_LABELS[block]}</label>
              ))}
              {errors.blocks ? <p className="text-xs font-medium text-red-800" role="alert">{errors.blocks}</p> : <p className="text-xs text-stone-600">These fill in automatically when the issue is sent.</p>}
            </fieldset>
            <div><Button className="min-h-11" disabled={busy !== null} onClick={() => void onPreview()}>{busy === 'preview' ? 'Loading…' : preview ? 'Reload preview' : 'Preview'}</Button><span className="ml-3 text-xs text-stone-600">Saves your draft first.</span></div>
            <EmailPreview preview={preview} loading={busy === 'preview'} />
          </form>
        )}
      </Sheet>
      <ConfirmDialog open={confirm === 'send'} onCancel={() => setConfirm(null)} onConfirm={send} confirmLabel={`Send to ${people(confirmed ?? 0)}`} title="Send this issue?"
        description={<><p>"{issue?.subject}" will be emailed to <strong>{people(confirmed ?? 0)}</strong> who have confirmed their subscription. Each person gets it once.</p><p className="mt-2 font-medium text-stone-950">This cannot be undone.</p></>} />
      <ConfirmDialog open={confirm === 'delete'} onCancel={() => setConfirm(null)} onConfirm={remove} danger confirmLabel="Delete draft" title="Delete this draft?"
        description={<>"{issue?.subject}" will be removed. Nothing has been sent.</>} />
    </>
  );
}

export function NewsletterTab({ summary }: { summary: OutreachSummary | undefined }) {
  const { params, setParams } = useRoute();
  const list = useApi<NewsletterListResponse>('/admin/newsletters');
  const client = useQueryClient();
  const toast = useToast();
  const issues = list.data?.newsletters ?? [];
  const idParam = params.get('id');
  const initial = idParam && idParam !== 'new' ? issues.find((item) => item.id === idParam) ?? null : null;

  // While any issue is going out, check every two seconds; stop as soon as none is.
  const sending = issues.some((item) => item.status === 'sending');
  useEffect(() => {
    if (!sending) return;
    const timer = window.setInterval(() => { void client.invalidateQueries({ queryKey: ['/admin/newsletters'] }); void client.invalidateQueries({ queryKey: ['/admin/outreach'] }); }, 2000);
    return () => window.clearInterval(timer);
  }, [sending, client]);
  const seen = useRef(new Map<string, NewsletterStatus>());
  useEffect(() => {
    for (const item of issues) if (seen.current.get(item.id) === 'sending' && item.status === 'sent') toast.success(`"${item.subject}" was sent to ${people(item.recipientCount)}.`);
    seen.current = new Map(issues.map((item) => [item.id, item.status]));
  }, [issues]); // eslint-disable-line react-hooks/exhaustive-deps

  // The sheet keeps its state when a new draft gets its id in the address; any other change of id starts a fresh sheet.
  const created = useRef<string | null>(null);
  const lastId = useRef<string | null>(null);
  const generation = useRef(0);
  if (idParam !== lastId.current) { if (!(idParam && idParam === created.current)) generation.current += 1; lastId.current = idParam; }

  useEffect(() => { if (idParam && idParam !== 'new' && list.data && !initial && idParam !== created.current) setParams({ id: null }, { replace: true }); }, [idParam, list.data, initial, setParams]);

  const columns: Column<Newsletter>[] = [
    { key: 'subject', header: 'Subject', sort: (row) => row.subject.toLowerCase(), cell: (row) => <div><p className="font-medium text-stone-950">{row.subject}</p><span className="mt-1 inline-flex items-center gap-2 sm:hidden"><Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>{row.status !== 'draft' && <span className="text-xs text-stone-600">{people(row.recipientCount)}</span>}</span></div> },
    { key: 'status', header: 'Status', hideBelow: 'sm', sort: (row) => row.status, cell: (row) => <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge> },
    { key: 'recipients', header: 'Recipients', hideBelow: 'sm', sort: (row) => row.recipientCount, cell: (row) => (row.status === 'draft' ? <span className="text-stone-600">—</span> : row.recipientCount) },
    { key: 'date', header: 'Date', hideBelow: 'sm', sort: (row) => row.sentAt ?? row.updatedAt, cell: (row) => (row.sentAt ? `Sent ${formatDate(row.sentAt)}` : row.status === 'sending' ? 'Going out now' : `Edited ${formatDate(row.updatedAt)}`) },
  ];
  const showSheet = idParam === 'new' || Boolean(initial) || (Boolean(idParam) && idParam === created.current);

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm leading-6 text-stone-700">Each issue goes to {summary ? people(summary.subscribers.confirmed) : 'everyone'} who confirmed their subscription. Sending is queued and delivered within minutes; you can follow it here.</p>
        <Button variant="primary" className="min-h-11" onClick={() => setParams({ id: 'new' })}><PlusIcon width={16} height={16} />New issue</Button>
      </div>
      <div className="mt-4">
        <DataTable rows={issues} columns={columns} rowId={(row) => row.id} loading={list.isLoading} error={list.isError ? errorMessage(list.error, 'Issues could not be loaded.') : null} tableClassName="min-w-0" selectedId={idParam} onRowClick={(row) => setParams({ id: row.id })} initialSort={{ key: 'date', dir: 'desc' }} pageSize={15}
          empty={<EmptyState title="No issues yet" action={<Button variant="primary" className="min-h-11" onClick={() => setParams({ id: 'new' })}>Write the first issue</Button>}>Draft an issue, preview it, send yourself a test, then send it to your subscribers.</EmptyState>} />
      </div>
      {showSheet && (
        <IssueSheet key={generation.current} initial={initial} confirmed={summary?.subscribers.confirmed}
          onCreated={(id) => { created.current = id; setParams({ id }, { replace: true }); }}
          onClose={() => { created.current = null; setParams({ id: null }); }} />
      )}
    </div>
  );
}
