import { useEffect, useId, useRef, useState, type SyntheticEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { matchStrength, type FieldErrors, type LostPetInquiry, type LostPetInquiryListResponse, type LostPetMatch, type LostPetSearchResponse, type MemberProfileResponse } from '@pawheaven/contracts';
import { ApiRequestError, api, errorMessage, loginUrl, useApi, useMe } from '../../lib/fetch';
import { Badge, Button, Card, ErrorSummary, Field, Input, Notice, Select, Skeleton, Textarea, TextLink, cx } from '../../ui';
import { PawIcon } from '../../ui/icons';

const MAX_PHOTOS = 3;
const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const DRAFT_KEY = 'ph-lost-draft';

type Draft = { species: string; description: string };

function loadDraft(): Draft | null {
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    const parsed = raw ? JSON.parse(raw) as Partial<Draft> : null;
    return parsed && typeof parsed.species === 'string' ? { species: parsed.species, description: typeof parsed.description === 'string' ? parsed.description.slice(0, 300) : '' } : null;
  } catch { return null; }
}
const saveDraft = (draft: Draft) => { try { window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); } catch { /* Storage blocked: the draft just will not be kept. */ } };
const clearDraft = () => { try { window.sessionStorage.removeItem(DRAFT_KEY); } catch { /* Nothing to clear. */ } };

const article = (word: string) => (/^[aeiou]/i.test(word) ? 'an' : 'a');
const matchAlt = (pet: LostPetMatch['pet']) => { const kind = pet.breed || pet.type; return `${pet.name}, ${article(kind)} ${kind}`; };
const sizeMb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

/** What each band means, in words, so the band is never the only information. */
const STRENGTH_TEXT = { Strong: 'Looks very similar to your photos', Likely: 'Looks fairly similar to your photos', Possible: 'Has some things in common with your photos' } as const;

type Photo = { id: number; file: File; url: string };
let photoCounter = 0;

function PhotoPicker({ photos, setPhotos, error }: { photos: Photo[]; setPhotos: (next: (current: Photo[]) => Photo[]) => void; error?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState('');
  const urls = useRef(new Set<string>());
  useEffect(() => { const held = urls.current; return () => { for (const url of held) URL.revokeObjectURL(url); }; }, []);

  function add(list: FileList | null) {
    if (!list?.length) return;
    const incoming = [...list];
    const problems: string[] = [];
    const room = MAX_PHOTOS - photos.length;
    const accepted: Photo[] = [];
    for (const file of incoming) {
      if (!TYPES.includes(file.type)) { problems.push(`${file.name} is not a JPEG, PNG, or WebP photo.`); continue; }
      if (file.size > MAX_BYTES) { problems.push(`${file.name} is ${sizeMb(file.size)}. Each photo must be smaller than 5 MB.`); continue; }
      if (accepted.length >= room) { problems.push(`Only ${MAX_PHOTOS} photos fit. ${file.name} was not added.`); continue; }
      const url = URL.createObjectURL(file);
      urls.current.add(url);
      accepted.push({ id: ++photoCounter, file, url });
    }
    if (accepted.length) setPhotos((current) => [...current, ...accepted]);
    setMessage(problems.length ? problems.join(' ') : accepted.length ? `${accepted.length} photo${accepted.length === 1 ? '' : 's'} added.` : '');
    if (inputRef.current) inputRef.current.value = '';
  }

  function remove(photo: Photo) {
    URL.revokeObjectURL(photo.url);
    urls.current.delete(photo.url);
    setPhotos((current) => current.filter((item) => item.id !== photo.id));
    setMessage(`Removed ${photo.file.name}.`);
  }

  return (
    <div>
      <Field label="Photos of your pet" required help={`Add up to ${MAX_PHOTOS} JPEG, PNG, or WebP photos, each smaller than 5 MB. Clear, well-lit photos of the face and whole body work best.`} error={error}>
        {(a) => <input {...a} ref={inputRef} type="file" accept={TYPES.join(',')} multiple disabled={photos.length >= MAX_PHOTOS} onChange={(event) => add(event.target.files)} className="block w-full min-h-11 rounded-[var(--ph-radius)] border border-stone-500 bg-white p-2 text-base text-stone-950 file:mr-3 file:min-h-9 file:rounded-[var(--ph-radius)] file:border-0 file:bg-stone-200 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-stone-950 disabled:bg-stone-100 disabled:text-stone-600" />}
      </Field>
      <p role="status" className={cx('mt-2 text-sm', message ? 'text-stone-800' : 'sr-only')}>{message}</p>
      {photos.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-3" aria-label="Photos you chose">
          {photos.map((photo, index) => (
            <li key={photo.id} className="w-28">
              <img src={photo.url} alt={`Your photo ${index + 1}: ${photo.file.name}`} className="aspect-square w-28 rounded-[var(--ph-radius)] border border-stone-300 object-cover" />
              <button type="button" onClick={() => remove(photo)} className="mt-1 inline-flex min-h-11 w-full items-center justify-center rounded-[var(--ph-radius)] border border-stone-400 bg-white px-2 text-sm font-semibold text-stone-900 hover:bg-stone-100">
                Remove<span className="sr-only"> photo {index + 1}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InquiryForm({ searchId, match, onSent }: { searchId: string; match: LostPetMatch; onSent: () => void }) {
  const profile = useApi<MemberProfileResponse>('/profile');
  const [phone, setPhone] = useState('');
  const [touched, setTouched] = useState(false);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [summary, setSummary] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const phoneRef = useRef<HTMLInputElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => phoneRef.current?.focus(), []);
  useEffect(() => { if (!touched && profile.data?.profile.phone) setPhone(profile.data.profile.phone); }, [profile.data, touched]);

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    const problems: FieldErrors = {};
    if (phone.replace(/\D/g, '').length < 10) problems.phone = 'Enter a phone number with at least 10 digits.';
    if (message.trim().length < 10) problems.message = 'Tell the shelter a little more, at least 10 characters.';
    setErrors(problems);
    if (Object.keys(problems).length) { setSummary(Object.values(problems)); (problems.phone ? phoneRef : messageRef).current?.focus(); return; }
    setSummary([]);
    setBusy(true);
    try {
      await api('/lost-pet/inquiries', { method: 'POST', json: { searchId, petId: match.pet.id, phone: phone.trim(), message: message.trim() } });
      setSent(true);
      onSent();
    } catch (error) {
      if (error instanceof ApiRequestError && error.fieldErrors) setErrors(error.fieldErrors);
      setSummary([errorMessage(error, 'We could not send your message. Please try again.')]);
    } finally { setBusy(false); }
  }

  if (sent) return <Notice tone="success" title={`Your message about ${match.pet.name} was sent.`} className="mt-4">We emailed you a confirmation. Staff will contact you to check whether this is your pet.</Notice>;
  return (
    <form onSubmit={submit} noValidate className="mt-4 grid gap-4 border-t border-stone-200 pt-4 sm:max-w-lg">
      <ErrorSummary errors={summary} />
      <Field label="Phone number" required error={errors.phone}>
        {(a) => <Input {...a} ref={phoneRef} type="tel" name="phone" autoComplete="tel" maxLength={30} value={phone} onChange={(e) => { setPhone(e.target.value); setTouched(true); setSummary([]); }} />}
      </Field>
      <Field label={`Message for the shelter about ${match.pet.name}`} required help="Say when and where your pet went missing, any collar or microchip, and marks that do not show in your photos. Staff will check with you: a photo match does not confirm ownership." error={errors.message}>
        {(a) => <Textarea {...a} ref={messageRef} name="message" maxLength={1000} rows={4} value={message} onChange={(e) => { setMessage(e.target.value); setSummary([]); }} />}
      </Field>
      <div><Button type="submit" variant="primary" disabled={busy}>{busy ? 'Sending…' : 'Send to the shelter'}</Button></div>
    </form>
  );
}

function MatchCard({ searchId, match, onSent }: { searchId: string; match: LostPetMatch; onSent: () => void }) {
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const strength = matchStrength(match.confidence);
  const detail = [match.pet.type, match.pet.breed, match.pet.age, match.pet.status === 'Available' ? 'Available for adoption' : match.pet.status].filter(Boolean).join(' · ');
  return (
    <li>
      <Card as="article">
        <div className="grid gap-4 sm:grid-cols-[11rem_minmax(0,1fr)]">
          {match.pet.imageUrl && !failed
            ? <img src={match.pet.imageUrl} alt={matchAlt(match.pet)} loading="lazy" onError={() => setFailed(true)} className="aspect-[4/3] w-full rounded-[var(--ph-radius)] bg-stone-200 object-cover" />
            : <div role="img" aria-label={`No photo of ${match.pet.name} yet`} className="flex aspect-[4/3] w-full items-center justify-center rounded-[var(--ph-radius)] bg-stone-200 text-stone-700"><PawIcon width={32} height={32} /></div>}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-lg font-semibold text-stone-950">{match.pet.name}</h4>
              <Badge tone={strength === 'Possible' ? 'neutral' : 'good'}>{strength} visual match</Badge>
            </div>
            <p className="mt-1 text-sm text-stone-700">{detail}</p>
            <p className="mt-1 text-sm font-medium text-stone-800">{STRENGTH_TEXT[strength]}.</p>
            <p className="mt-3 text-base leading-7 text-stone-800">{match.reason}</p>
            {!open && <div className="mt-4"><Button variant="secondary" onClick={() => setOpen(true)} aria-expanded={open}>Ask the shelter about {match.pet.name}</Button></div>}
          </div>
        </div>
        {open && <InquiryForm searchId={searchId} match={match} onSent={onSent} />}
      </Card>
    </li>
  );
}

function Results({ result, onSent }: { result: LostPetSearchResponse; onSent: () => void }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => { headingRef.current?.focus(); headingRef.current?.scrollIntoView({ block: 'start' }); }, [result]);
  const count = result.matches.length;
  return (
    <section aria-labelledby="results-heading" className="mt-8 border-t border-stone-300 pt-6">
      <h3 id="results-heading" ref={headingRef} tabIndex={-1} className="text-xl font-semibold text-stone-950 focus:outline-none">
        {count && result.searchId ? `${count} possible ${count === 1 ? 'match' : 'matches'}` : 'No possible match right now'}
      </h3>
      <div role="status" className="sr-only">{count && result.searchId ? `${count} possible ${count === 1 ? 'match' : 'matches'} found.` : 'No possible match found.'}</div>
      {!count || !result.searchId ? (
        <div className="mt-3 grid max-w-2xl gap-3">
          <p className="text-base leading-7 text-stone-800">{result.notice ?? 'We did not find a possible match among the animals in the shelter right now.'}</p>
          <p className="text-base leading-7 text-stone-800">New animals arrive often. <TextLink href="#visit-often">Check back soon</TextLink>, <TextLink href="/lost-pet/flyer">make a flyer</TextLink>, or call the shelter.</p>
        </div>
      ) : (
        <>
          <p className="mt-2 max-w-2xl border-l-4 border-stone-400 pl-3 text-sm leading-6 text-stone-800">These are visual comparisons made by an AI model. A similar-looking animal is not proof that it is your pet: shelter staff confirm ownership. Choose an animal to send staff a message.</p>
          <ul className="mt-5 grid gap-4">{result.matches.map((match) => <MatchCard key={match.pet.id} searchId={result.searchId as string} match={match} onSent={onSent} />)}</ul>
        </>
      )}
    </section>
  );
}

export function Inquiries({ heading = 'Your messages to the shelter' }: { heading?: string }) {
  const list = useApi<LostPetInquiryListResponse>('/lost-pet/inquiries', { staleSeconds: 5 });
  return (
    <section aria-labelledby="inquiries-heading" className="mt-10 border-t border-stone-300 pt-6">
      <h3 id="inquiries-heading" className="text-xl font-semibold text-stone-950">{heading}</h3>
      {list.isPending && <Skeleton className="mt-3 h-20 max-w-xl" />}
      {list.isError && <p className="mt-2 text-base text-stone-800">We could not load your messages right now. Please refresh in a moment.</p>}
      {list.data && !list.data.inquiries.length && <p className="mt-2 text-base text-stone-800">You have not contacted the shelter about a possible match yet.</p>}
      {list.data && list.data.inquiries.length > 0 && <ul className="mt-4 grid gap-3">{list.data.inquiries.map((inquiry: LostPetInquiry) => (
        <li key={inquiry.id} className="rounded-[var(--ph-radius)] border border-stone-300 bg-white px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-semibold text-stone-950">{inquiry.petName}</p><Badge tone={inquiry.status === 'Resolved' ? 'good' : inquiry.status === 'In progress' ? 'warn' : 'neutral'}>{inquiry.status}</Badge></div>
          <p className="mt-1 text-sm text-stone-700">Sent {new Date(inquiry.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}</p>
          <p className="mt-2 whitespace-pre-wrap text-base leading-7 text-stone-800">{inquiry.message}</p>
        </li>))}</ul>}
    </section>
  );
}

/** Option 1: compare photos with the animals in the shelter. Guests fill in the form, then sign in to run it. */
export function PhotoSearch() {
  const me = useMe();
  const idBase = useId();
  const [species, setSpecies] = useState('Dog');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [summary, setSummary] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<LostPetSearchResponse | null>(null);
  const [failure, setFailure] = useState<{ message: string; signIn?: boolean } | null>(null);
  const [resumed, setResumed] = useState(false);
  const queryClient = useQueryClient();
  const photoWrap = useRef<HTMLDivElement>(null);
  const speciesRef = useRef<HTMLSelectElement>(null);
  const signedIn = Boolean(me.data);

  useEffect(() => {
    const draft = loadDraft();
    if (draft) { setSpecies(['Dog', 'Cat', 'Other'].includes(draft.species) ? draft.species : 'Dog'); setDescription(draft.description); setResumed(true); }
  }, []);
  useEffect(() => { if (signedIn && resumed) clearDraft(); }, [signedIn, resumed]);

  const photoError = errors.photos;
  const updatePhotos = (next: (current: Photo[]) => Photo[]) => { setPhotos(next); setErrors((current) => (current.photos ? { ...current, photos: '' } : current)); setSummary([]); };

  function validate() {
    const problems: FieldErrors = {};
    if (!photos.length && signedIn) problems.photos = 'Add at least one photo of your pet.';
    return problems;
  }

  async function submit(event: SyntheticEvent) {
    event.preventDefault();
    if (busy) return;
    setFailure(null);
    if (!signedIn) {
      saveDraft({ species, description: description.trim() });
      window.location.assign(loginUrl('/lost-pet#check'));
      return;
    }
    const problems = validate();
    setErrors(problems);
    if (Object.keys(problems).length) { setSummary(Object.values(problems)); photoWrap.current?.querySelector('input')?.focus(); return; }
    setSummary([]);
    setBusy(true);
    setResult(null);
    const data = new FormData();
    data.append('species', species);
    data.append('description', description.trim());
    for (const photo of photos) data.append('photos', photo.file);
    try {
      const response = await api<LostPetSearchResponse>('/lost-pet/searches', { method: 'POST', body: data });
      clearDraft();
      setResult(response);
    } catch (error) {
      if (error instanceof ApiRequestError && error.fieldErrors) { setErrors(error.fieldErrors); setSummary(Object.values(error.fieldErrors)); }
      setFailure({ message: errorMessage(error, 'We could not compare your photos right now. Please try again, or call the shelter.'), signIn: error instanceof ApiRequestError && error.status === 401 });
    } finally { setBusy(false); }
  }

  return (
    <div>
      <p className="max-w-2xl text-base leading-7 text-stone-800">Add up to three clear photos of your pet. We compare them with the photos of animals in our care and show any that look similar, so you can ask staff to check in person.</p>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-700">Your photos are sent to an AI provider for the comparison. If there is no possible match your photos are deleted right away. If there is, we keep them for 30 days so staff can check, then delete them.</p>

      {!signedIn && !me.isPending && (
        <Notice tone="info" title="You will sign in to run the search." className="mt-5 max-w-2xl">
          You can fill this in first. When you choose &ldquo;Sign in to search by photo&rdquo; we keep what you typed (the kind of animal and the description) on this device until you are signed in, then bring you back here. We do not keep your photos, so you will choose them again.
        </Notice>
      )}
      {resumed && signedIn && (
        <Notice tone="success" title="Welcome back." className="mt-5 max-w-2xl">We kept what you typed. Please choose your photos again to run the search.</Notice>
      )}

      <form onSubmit={submit} noValidate className="mt-6 grid max-w-xl gap-5" aria-describedby={`${idBase}-note`}>
        <ErrorSummary errors={summary} />
        <Field label="Kind of animal" required>
          {(a) => <Select {...a} ref={speciesRef} name="species" value={species} onChange={(e) => setSpecies(e.target.value)}>{['Dog', 'Cat', 'Other'].map((value) => <option key={value}>{value}</option>)}</Select>}
        </Field>
        <Field label="Describe your pet (optional)" help="Color, markings, size, collar, anything that stands out." error={errors.description}>
          {(a) => <Textarea {...a} name="description" rows={3} maxLength={300} value={description} onChange={(e) => setDescription(e.target.value)} />}
        </Field>
        <div ref={photoWrap}><PhotoPicker photos={photos} setPhotos={updatePhotos} error={photoError || undefined} /></div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" disabled={busy || me.isPending}>
            {busy ? 'Comparing photos…' : signedIn ? 'Search by photo' : 'Sign in to search by photo'}
          </Button>
        </div>
        <p id={`${idBase}-note`} role="status" className="text-sm text-stone-800">
          {busy ? 'Comparing your photos with our animals. This can take up to a minute. Please keep this page open.' : ''}
        </p>
        {failure && (
          <Notice tone="error" title="The search did not finish">
            {failure.message}{' '}
            {failure.signIn ? <TextLink href={loginUrl('/lost-pet#check')} onClick={() => saveDraft({ species, description: description.trim() })}>Sign in again</TextLink> : null}
          </Notice>
        )}
      </form>

      {result && <Results result={result} onSent={() => void queryClient.invalidateQueries({ queryKey: ['/lost-pet/inquiries'] })} />}
      {signedIn && <Inquiries />}
    </div>
  );
}
