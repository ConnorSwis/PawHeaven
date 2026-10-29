import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { ENERGY_LEVELS, PET_SEXES, PET_SIZES, PET_STATUSES, YES_NO_UNKNOWN, type Pet } from '@pawheaven/contracts';
import { apiBase } from '../../../lib/api';
import { ApiRequestError, api, errorMessage, useRefresh } from '../../lib/api';
import { shelterDay } from '../../lib/format';
import { useRoute } from '../../lib/router';
import { Badge, Button, ConfirmDialog, Detail, Field, Input, Select, Sheet, StatusBadge, Tabs, Textarea } from '../../ui';
import { PawIcon } from '../../ui/icons';
import { useToast } from '../../ui/toast';
import { TAB_FIELDS, draftFromPet, emptyDraft, inputFromDraft, type PetDraft } from './petForm';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
type TabId = 'basics' | 'details' | 'photo' | 'foster' | 'source';

const options = (values: readonly string[], blank?: string) => [
  ...(blank !== undefined ? [<option key="blank" value="">{blank}</option>] : []),
  ...values.map((value) => <option key={value} value={value}>{value}</option>),
];

function Toggle({ label, help, checked, onChange }: { label: string; help: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-start gap-3 border border-stone-300 p-3 text-sm">
      <input type="checkbox" className="mt-1" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span><span className="block font-medium text-stone-950">{label}</span><span className="mt-0.5 block text-stone-700">{help}</span></span>
    </label>
  );
}

export function PetEditor({ id, pet, onClose }: { id: string; pet: Pet | undefined; onClose: () => void }) {
  const isNew = id === 'new';
  const toast = useToast();
  const refresh = useRefresh();
  const { navigate } = useRoute();
  const initial = useMemo(() => (pet ? draftFromPet(pet) : emptyDraft(shelterDay(Date.now()))), [pet]);
  const [draft, setDraft] = useState<PetDraft>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<TabId>('basics');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);

  // Switching to another animal (or the list finishing its load) resets the form.
  useEffect(() => { setDraft(initial); setErrors({}); setFile(null); setFileError(''); setTab('basics'); }, [initial, id]);
  useEffect(() => {
    if (!file) { setPreview(null); return undefined; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const set = <K extends keyof PetDraft>(key: K, value: PetDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial) || file !== null;
  const err = (key: string) => errors[key];
  const tabHasError = (fields: readonly string[]) => fields.some((field) => errors[field]);

  const pickFile = (next: File | null) => {
    setFileError('');
    if (!next) { setFile(null); return; }
    if (!IMAGE_TYPES.includes(next.type) || next.size === 0 || next.size > MAX_IMAGE_BYTES) { setFile(null); setFileError('Choose a JPEG, PNG, or WebP image smaller than 5 MB.'); return; }
    setFile(next);
  };

  const uploadPhoto = async (petId: string, image: File) => {
    const body = new FormData();
    body.append('image', image);
    const response = await fetch(`${apiBase}/admin/pets/${encodeURIComponent(petId)}/image`, { method: 'POST', credentials: 'include', body });
    const payload = await response.json().catch(() => null) as { message?: unknown } | null;
    if (!response.ok) throw new Error(typeof payload?.message === 'string' ? payload.message : 'The photo could not be uploaded.');
  };

  const save = async () => {
    setBusy(true);
    setErrors({});
    let savedId = isNew ? '' : id;
    try {
      const saved = await api<Pet>(isNew ? '/admin/pets' : `/admin/pets/${encodeURIComponent(id)}`, { method: isNew ? 'POST' : 'PUT', json: inputFromDraft(draft) });
      savedId = saved.id;
      // Visits and walkers have their own endpoint; foster availability rides along with the pet itself.
      const flags: { visitsOpen?: boolean; needsWalkers?: boolean } = {};
      if (draft.visitsOpen !== initial.visitsOpen) flags.visitsOpen = draft.visitsOpen;
      if (draft.needsWalkers !== initial.needsWalkers) flags.needsWalkers = draft.needsWalkers;
      if (Object.keys(flags).length) await api('/admin/pets/flags', { method: 'POST', json: { petIds: [saved.id], ...flags } });
      if (file) {
        try { await uploadPhoto(saved.id, file); } catch (error) {
          await refresh('/admin/pets');
          toast.error(`${saved.name} was saved, but the photo failed: ${errorMessage(error)}`);
          if (isNew) navigate(`/animals?id=${saved.id}`);
          setTab('photo'); setFileError(errorMessage(error));
          return;
        }
      }
      await refresh('/admin/pets');
      toast.success(isNew ? `${saved.name} was added.` : `${saved.name} was saved.`);
      onClose();
    } catch (error) {
      if (error instanceof ApiRequestError && error.fieldErrors) {
        setErrors(error.fieldErrors);
        const first = Object.keys(error.fieldErrors)[0];
        setTab((TAB_FIELDS.details as readonly string[]).includes(first) ? 'details' : 'basics');
        toast.error(Object.keys(error.fieldErrors).length > 1 ? 'Please correct the highlighted fields.' : Object.values(error.fieldErrors)[0]);
      } else {
        toast.error(errorMessage(error));
        if (savedId && isNew) await refresh('/admin/pets');
      }
    } finally { setBusy(false); }
  };

  const remove = async () => {
    try {
      await api(`/admin/pets/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await refresh('/admin/pets');
      toast.success(`${draft.name || 'The animal'} was removed.`);
      setConfirmRemove(false);
      onClose();
    } catch (error) {
      setConfirmRemove(false);
      toast.error(`${errorMessage(error)} Animals with applications usually cannot be removed; set the status to Unavailable or Adopted instead.`);
    }
  };

  const currentImage = preview ?? pet?.imageUrl ?? null;
  const title = isNew ? 'Add an animal' : (pet?.name ?? 'Animal');
  const missing = !isNew && !pet;

  const tabs: { id: TabId; label: string }[] = [
    { id: 'basics', label: tabHasError(TAB_FIELDS.basics) ? 'Basics (fix)' : 'Basics' },
    { id: 'details', label: tabHasError(TAB_FIELDS.details) ? 'Details (fix)' : 'Details' },
    { id: 'photo', label: 'Photo' },
    { id: 'foster', label: 'Foster and visits' },
    ...(!isNew ? [{ id: 'source' as TabId, label: 'Source' }] : []),
  ];

  let body: ReactNode = null;
  if (tab === 'basics') {
    body = (
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Name" error={err('name')}><Input value={draft.name} onChange={(event) => set('name', event.target.value)} maxLength={100} autoFocus={isNew} /></Field>
        <Field label="Status" error={err('status')} help="Only Available animals appear on the public site."><Select value={draft.status} onChange={(event) => set('status', event.target.value as Pet['status'])}>{options(PET_STATUSES)}</Select></Field>
        <Field label="Species" error={err('type')}><Input value={draft.type} onChange={(event) => set('type', event.target.value)} list="pet-species-options" placeholder="Dog" /><datalist id="pet-species-options"><option value="Dog" /><option value="Cat" /><option value="Rabbit" /><option value="Other" /></datalist></Field>
        <Field label="Breed" error={err('breed')}><Input value={draft.breed} onChange={(event) => set('breed', event.target.value)} placeholder="Mixed breed" /></Field>
        <Field label="Age" error={err('age')}><Input value={draft.age} onChange={(event) => set('age', event.target.value)} placeholder="2 years" /></Field>
        <Field label="Intake date" error={err('intakeDate')}><Input type="date" value={draft.intakeDate} onChange={(event) => set('intakeDate', event.target.value)} /></Field>
        <Field label="Tags" error={err('tags')} help="Separate up to 20 tags with commas, such as big-dog, gentle." className="sm:col-span-2"><Input value={draft.tags} onChange={(event) => set('tags', event.target.value)} placeholder="big-dog, gentle, family-friendly" /></Field>
        <Field label="Description" error={err('summary')} help="Shown on the animal's public page." className="sm:col-span-2"><Textarea rows={5} value={draft.summary} onChange={(event) => set('summary', event.target.value)} /></Field>
        <Field label="Medical history" error={err('medicalHistory')} help="Shown publicly. Do not include private staff notes." className="sm:col-span-2"><Textarea rows={3} value={draft.medicalHistory} onChange={(event) => set('medicalHistory', event.target.value)} placeholder="Vaccinations, spay/neuter, ongoing care" /></Field>
      </div>
    );
  } else if (tab === 'details') {
    body = (
      <div className="grid gap-4 sm:grid-cols-2">
        <p className="text-sm text-stone-700 sm:col-span-2">Visitors can search on these, and the matching quiz uses them.</p>
        <Field label="Sex" error={err('sex')}><Select value={draft.sex} onChange={(event) => set('sex', event.target.value as Pet['sex'])}>{options(PET_SEXES, 'Not recorded')}</Select></Field>
        <Field label="Size" error={err('size')}><Select value={draft.size} onChange={(event) => set('size', event.target.value as Pet['size'])}>{options(PET_SIZES, 'Not recorded')}</Select></Field>
        <Field label="Color" error={err('color')}><Input value={draft.color} onChange={(event) => set('color', event.target.value)} maxLength={100} placeholder="Black and white" /></Field>
        <Field label="Weight (pounds)" error={err('weightLbs')}><Input type="number" min={1} max={400} value={draft.weight} onChange={(event) => set('weight', event.target.value)} /></Field>
        <Field label="Energy level" error={err('energyLevel')}><Select value={draft.energyLevel} onChange={(event) => set('energyLevel', event.target.value as Pet['energyLevel'])}>{options(ENERGY_LEVELS, 'Not recorded')}</Select></Field>
        <Field label="Spayed or neutered" error={err('spayedNeutered')}><Select value={draft.spayedNeutered} onChange={(event) => set('spayedNeutered', event.target.value as Pet['spayedNeutered'])}>{options(YES_NO_UNKNOWN)}</Select></Field>
        <Field label="Good with kids" error={err('goodWithKids')}><Select value={draft.goodWithKids} onChange={(event) => set('goodWithKids', event.target.value as Pet['goodWithKids'])}>{options(YES_NO_UNKNOWN)}</Select></Field>
        <Field label="Good with dogs" error={err('goodWithDogs')}><Select value={draft.goodWithDogs} onChange={(event) => set('goodWithDogs', event.target.value as Pet['goodWithDogs'])}>{options(YES_NO_UNKNOWN)}</Select></Field>
        <Field label="Good with cats" error={err('goodWithCats')}><Select value={draft.goodWithCats} onChange={(event) => set('goodWithCats', event.target.value as Pet['goodWithCats'])}>{options(YES_NO_UNKNOWN)}</Select></Field>
      </div>
    );
  } else if (tab === 'photo') {
    body = (
      <div className="grid gap-4">
        <div className="grid aspect-[4/3] w-full max-w-sm place-items-center overflow-hidden border border-stone-300 bg-stone-100">
          {currentImage ? <img src={currentImage} alt={draft.name ? `${draft.name}` : 'Selected photo'} className="size-full object-cover" /> : <PawIcon width={48} height={48} className="text-stone-500" />}
        </div>
        {file && <p className="text-sm text-stone-700">New photo selected: {file.name}. It uploads when you save.</p>}
        <Field label={currentImage ? 'Replace the photo' : 'Upload a photo'} error={fileError} help="Public-facing photo only. JPEG, PNG, or WebP, 5 MB maximum."><Input type="file" accept={IMAGE_TYPES.join(',')} onChange={(event) => pickFile(event.target.files?.[0] ?? null)} /></Field>
        {file && <Button className="justify-self-start" onClick={() => { setFile(null); setFileError(''); }}>Keep the current photo</Button>}
        {!isNew && pet && pet.galleryUrls.length > 0 && (
          <div><p className="text-sm font-medium text-stone-900">More photos</p><div className="mt-2 flex flex-wrap gap-2">{pet.galleryUrls.map((url) => <img key={url} src={url} alt="" className="size-16 border border-stone-300 object-cover" />)}</div></div>
        )}
      </div>
    );
  } else if (tab === 'foster') {
    body = (
      <div className="grid gap-3">
        <Toggle label="Open to foster applications" help="Shows an “Open to foster” badge on this animal's public page and lets members apply to foster." checked={draft.fosterAvailable} onChange={(value) => set('fosterAvailable', value)} />
        <Toggle label="Offer for visits" help="Visitors can choose this animal when they book a shelter visit." checked={draft.visitsOpen} onChange={(value) => set('visitsOpen', value)} />
        <Toggle label="Needs walkers" help="Shows a note on the public page and links volunteers to shifts." checked={draft.needsWalkers} onChange={(value) => set('needsWalkers', value)} />
        {pet?.fosterUrgent && <p className="text-sm text-stone-800"><Badge tone="warn">Foster needed now</Badge> There is an open foster request for this animal.</p>}
        {!isNew && pet?.status === 'Available' && (
          <div className="border-t border-stone-200 pt-4">
            <p className="text-sm text-stone-700">Need a foster home quickly? Email everyone in the foster pool.</p>
            <Button className="mt-2" onClick={() => navigate(`/fostering?tab=pool&pet=${encodeURIComponent(id)}`)}>Ask the foster pool</Button>
          </div>
        )}
      </div>
    );
  } else if (tab === 'source' && pet) {
    body = (
      <dl className="grid gap-4">
        <Detail label="Housing">{pet.housing}</Detail>
        <Detail label="Listing from">{pet.sourceName}</Detail>
        <Detail label="Link back">{pet.sourceUrl && /^https:\/\//.test(pet.sourceUrl) ? <a className="text-[var(--ph-brand-strong)] underline underline-offset-4" href={pet.sourceUrl} target="_blank" rel="noopener noreferrer">{pet.sourceUrl}</a> : ''}</Detail>
        <Detail label="Public status"><StatusBadge status={pet.status} /></Detail>
        <Detail label="Days in the shelter">{String(pet.daysInShelter)}</Detail>
        <p className="text-sm text-stone-700">Animals imported from another organization keep their credit and link on the public page.</p>
      </dl>
    );
  }

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }} title={title} description={isNew ? 'Fill in the basics; you can add details and a photo before saving.' : pet ? `${pet.type} · ${pet.breed || 'Breed not recorded'}` : 'Loading…'} width="max-w-2xl"
      footer={(
        <>
          {!isNew && pet && <Button variant="danger" onClick={() => setConfirmRemove(true)} disabled={busy}>Remove animal</Button>}
          <span className="flex-1" />
          <Button onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="primary" onClick={() => void save()} disabled={busy || missing || (!isNew && !dirty)}>{busy ? 'Saving…' : isNew ? 'Add animal' : 'Save changes'}</Button>
        </>
      )}>
      {missing ? <p className="text-sm text-stone-700">That animal could not be found. It may have been removed.</p> : (
        <div className="grid gap-5">
          <Tabs value={tab} onChange={(next) => setTab(next as TabId)} items={tabs} />
          {body}
        </div>
      )}
      <ConfirmDialog open={confirmRemove} danger title={`Remove ${draft.name || 'this animal'}?`} confirmLabel="Remove animal" onCancel={() => setConfirmRemove(false)} onConfirm={remove}
        description={<>This deletes the record and its photo. If anyone has applied for this animal the database may refuse; in that case set the status to Unavailable or Adopted instead.</>} />
    </Sheet>
  );
}
