import { useState } from 'react';
import type { AdminLostPetInquiry, LostPetInquiryStatus } from '@pawheaven/contracts';
import { api, errorMessage, useRefresh } from '../../lib/api';
import { formatDate } from '../../lib/format';
import { Button, Detail, Field, Select, Sheet, StatusBadge, Textarea } from '../../ui';
import { useToast } from '../../ui/toast';

export function LostPetSheet({ inquiry, onClose }: { inquiry: AdminLostPetInquiry; onClose: () => void }) {
  const [status, setStatus] = useState<LostPetInquiryStatus>(inquiry.status);
  const [note, setNote] = useState(inquiry.staffNote);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const refresh = useRefresh();

  const save = async () => {
    setBusy(true);
    try {
      await api(`/admin/lost-pet-inquiries/${inquiry.id}`, { method: 'PUT', json: { status, staffNote: note.trim() } });
      toast.success('Inquiry updated.');
      await refresh('/admin/lost-pet-inquiries');
    } catch (error) { toast.error(errorMessage(error)); } finally { setBusy(false); }
  };

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }} title={`${inquiry.memberName} · ${inquiry.petName}`} description={`Lost-pet inquiry sent ${formatDate(inquiry.createdAt)}`}
      footer={<><Button onClick={onClose}>Close</Button><Button variant="primary" disabled={busy || (status === inquiry.status && note.trim() === inquiry.staffNote)} onClick={() => void save()}>{busy ? 'Saving…' : 'Save'}</Button></>}>
      <div className="grid gap-5">
        <dl className="grid grid-cols-2 gap-4">
          <Detail label="Status"><StatusBadge status={inquiry.status} /></Detail>
          <Detail label="Looking for">{`${inquiry.searchSpecies}${inquiry.searchDescription ? ` · ${inquiry.searchDescription}` : ''}`}</Detail>
          <Detail label="Email">{inquiry.memberEmail}</Detail>
          <Detail label="Phone">{inquiry.memberPhone}</Detail>
        </dl>
        <section><h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-600">Their message</h3><p className="whitespace-pre-wrap text-sm leading-6 text-stone-800">{inquiry.message}</p></section>
        <section>
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-stone-600">Photos side by side</h3>
          <div className="grid grid-cols-2 gap-3">
            <figure>
              {inquiry.petImageUrl ? <img src={inquiry.petImageUrl} alt={`${inquiry.petName}, the matched shelter animal`} className="aspect-square w-full border border-stone-300 object-cover" /> : <div className="grid aspect-square place-items-center border border-dashed border-stone-300 text-xs text-stone-600">No shelter photo</div>}
              <figcaption className="mt-1 text-xs text-stone-600">Shelter animal: {inquiry.petName}</figcaption>
            </figure>
            <div className="grid gap-3">
              {inquiry.photoUrls.length ? inquiry.photoUrls.map((url, index) => (
                <figure key={url}><img src={url} alt={`Photo ${index + 1} uploaded by ${inquiry.memberName}`} className="aspect-square w-full border border-stone-300 object-cover" /><figcaption className="mt-1 text-xs text-stone-600">Member photo {index + 1}</figcaption></figure>
              )) : <div className="grid aspect-square place-items-center border border-dashed border-stone-300 p-2 text-center text-xs text-stone-600">Member photos have expired</div>}
            </div>
          </div>
        </section>
        <div className="grid gap-3 border-t border-stone-200 pt-5">
          <Field label="Status"><Select value={status} onChange={(event) => setStatus(event.target.value as LostPetInquiryStatus)}><option>New</option><option>In progress</option><option>Resolved</option></Select></Field>
          <Field label="Private staff note" help="Only staff see this. The member sees the status, never the note."><Textarea value={note} maxLength={1000} onChange={(event) => setNote(event.target.value)} /></Field>
        </div>
      </div>
    </Sheet>
  );
}
