import { useEffect, useRef, useState, type DragEvent } from 'react';
import { Providers } from '../../lib/providers';
import { useMe } from '../../lib/fetch';
import { Button, Card, ChipToggle, Field, Fieldset, Input, Notice, PageHeading, Switch, TextLink, cx } from '../../ui';
import { Flyer } from './Flyer';
import { EMPTY_FLYER, headlineText, tips, type FlyerData } from './flyer-text';

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const KINDS = ['Dog', 'Cat', 'Rabbit'];
const SEXES = ['Male', 'Female', 'Not sure'];
// Wider than the little preview text: the sheet shrinks its text to fit, so these are limits for sanity, not layout.
const LIMITS = { kind: 30, petName: 40, breed: 60, age: 30, appearance: 140, distinguishing: 140, lastSeenWhere: 120, note: 120, contactName: 60, contactPhone: 30, contactEmail: 100 };

function FlyerContent() {
  const me = useMe();
  const [data, setData] = useState<FlyerData>(EMPTY_FLYER);
  const [otherKind, setOtherKind] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoName, setPhotoName] = useState('');
  const [photoError, setPhotoError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const [view, setView] = useState<'edit' | 'preview'>('edit');
  const [touched, setTouched] = useState({ email: false, phone: false });
  const [today, setToday] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const filledName = useRef(false);

  useEffect(() => setToday(new Date().toISOString().slice(0, 10)), []);
  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);

  // Offer the account name as the contact name once, and never over something the person typed.
  useEffect(() => {
    const user = me.data;
    if (!user || filledName.current) return;
    filledName.current = true;
    setData((current) => ({ ...current, contactName: current.contactName || user.name }));
  }, [me.data]);

  const set = <K extends keyof FlyerData>(key: K, value: FlyerData[K]) => setData((current) => ({ ...current, [key]: value }));
  const text = (key: keyof typeof LIMITS) => ({
    value: data[key],
    maxLength: LIMITS[key],
    onChange: (event: { target: { value: string } }) => set(key, event.target.value as FlyerData[typeof key]),
  });

  function takePhoto(file: File | undefined) {
    setPhotoError('');
    if (!file) return;
    if (!PHOTO_TYPES.includes(file.type) || file.size > MAX_PHOTO_BYTES) {
      setPhotoError('Choose a JPEG, PNG, or WebP photo smaller than 10 MB.');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setPhotoName(file.name);
    setPhotoUrl(URL.createObjectURL(file));
  }
  function removePhoto() {
    setPhotoUrl(null); setPhotoName(''); setPhotoError('');
    if (fileRef.current) fileRef.current.value = '';
  }
  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault(); setDragging(false);
    takePhoto(event.dataTransfer.files?.[0]);
  }

  function print() {
    // The browser names a saved PDF after the page title, so give it a useful one for the moment of printing.
    const before = document.title;
    document.title = `${headlineText(data)}${data.petName.trim() ? ` - ${data.petName.trim()}` : ''} flyer`;
    const restore = () => { document.title = before; window.removeEventListener('afterprint', restore); };
    window.addEventListener('afterprint', restore);
    window.print();
  }

  function startOver() {
    if (!window.confirm('Clear everything you typed and the photo?')) return;
    setData({ ...EMPTY_FLYER, contactName: me.data?.name ?? '' });
    setOtherKind(false); removePhoto(); setTouched({ email: false, phone: false });
  }

  const kindIsPreset = KINDS.includes(data.kind);
  const missing = tips(data, Boolean(photoUrl));
  const emailError = touched.email && data.contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.contactEmail.trim()) ? 'This does not look like an email address. Check it before you print.' : undefined;
  const phoneError = touched.phone && data.contactPhone.trim() && data.contactPhone.replace(/\D/g, '').length < 7 ? 'This looks short. Check the number before you print.' : undefined;

  return (
    <div className="fl-page mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="fl-screen">
        <PageHeading title="Make a lost-pet flyer" intro="Fill in what you can. Everything is optional, and the flyer fills in as you type. When it looks right, print it or save it as a PDF." />
        <p className="mt-3 text-sm text-stone-700">Nothing you enter here is uploaded or saved. <TextLink href="/lost-pet">Back to lost a pet?</TextLink></p>
      </div>

      <div className="fl-screen sticky top-0 z-10 -mx-4 mt-4 flex gap-2 border-b border-stone-200 bg-[var(--color-page)] px-4 py-2 lg:hidden" role="group" aria-label="Show">
        <Button variant={view === 'edit' ? 'primary' : 'secondary'} aria-pressed={view === 'edit'} onClick={() => setView('edit')} className="flex-1">Fill it in</Button>
        <Button variant={view === 'preview' ? 'primary' : 'secondary'} aria-pressed={view === 'preview'} onClick={() => setView('preview')} className="flex-1">See the flyer</Button>
      </div>

      <div className="fl-stage-wrap mt-6 grid gap-8 lg:grid-cols-[minmax(0,27rem)_minmax(0,1fr)] lg:items-start lg:gap-10">
        <form className={cx('fl-screen grid gap-5', view === 'preview' && 'max-lg:hidden')} noValidate onSubmit={(event) => { event.preventDefault(); print(); }}>
          <Card className="grid gap-4">
            <h2 className="text-xl font-semibold text-stone-950">About your pet</h2>
            <Fieldset legend="Poster says">
              <div className="flex flex-wrap gap-2">
                {(['Lost', 'Missing'] as const).map((word) => <ChipToggle key={word} pressed={data.headline === word} onClick={() => set('headline', word)}>{word}</ChipToggle>)}
              </div>
            </Fieldset>
            <Fieldset legend="Kind of animal">
              <div className="flex flex-wrap gap-2">
                {KINDS.map((kind) => <ChipToggle key={kind} pressed={data.kind === kind} onClick={() => { setOtherKind(false); set('kind', data.kind === kind ? '' : kind); }}>{kind}</ChipToggle>)}
                <ChipToggle pressed={otherKind} onClick={() => { const next = !otherKind; setOtherKind(next); if (next && kindIsPreset) set('kind', ''); if (!next && !kindIsPreset) set('kind', ''); }}>Other</ChipToggle>
              </div>
              {otherKind && <Field label="What kind?" className="mt-2">{(a) => <Input {...a} placeholder="Guinea pig, bird, ferret…" autoComplete="off" {...text('kind')} />}</Field>}
            </Fieldset>
            <Field label="Pet’s name">{(a) => <Input {...a} placeholder="Biscuit" autoComplete="off" {...text('petName')} />}</Field>
            <Field label="Breed">{(a) => <Input {...a} placeholder="Beagle mix" autoComplete="off" {...text('breed')} />}</Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Age">{(a) => <Input {...a} placeholder="3 years" autoComplete="off" {...text('age')} />}</Field>
              <Fieldset legend="Sex">
                <div className="flex flex-wrap gap-2">
                  {SEXES.map((sex) => <ChipToggle key={sex} pressed={data.sex === sex} onClick={() => set('sex', data.sex === sex ? '' : sex)} className="px-3">{sex}</ChipToggle>)}
                </div>
              </Fieldset>
            </div>
            <Field label="Color and markings" help="What would you notice first?">{(a) => <Input {...a} placeholder="Brown and white, white patch on the chest" autoComplete="off" {...text('appearance')} />}</Field>
            <Field label="Collar, microchip, or other details">{(a) => <Input {...a} placeholder="Red collar, microchipped, limps on the left rear leg" autoComplete="off" {...text('distinguishing')} />}</Field>
          </Card>

          <Card className="grid gap-3">
            <h2 className="text-xl font-semibold text-stone-950">Photo</h2>
            <input id="flyer-photo" ref={fileRef} type="file" accept={PHOTO_TYPES.join(',')} onChange={(event) => takePhoto(event.target.files?.[0])} className="peer sr-only" tabIndex={photoUrl ? -1 : 0} aria-label="Photo of your pet" />
            {photoUrl ? (
              <div className="flex items-center gap-4">
                <img src={photoUrl} alt="" className="size-20 shrink-0 rounded-[var(--ph-radius-sm)] border border-stone-300 object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-base font-semibold text-stone-950">{photoName}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button onClick={() => fileRef.current?.click()}>Choose another</Button>
                    <Button variant="ghost" onClick={removePhoto}>Remove</Button>
                  </div>
                </div>
              </div>
            ) : (
              <label
                htmlFor="flyer-photo"
                onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={cx('flex min-h-36 cursor-pointer flex-col items-center justify-center gap-1 rounded-[var(--ph-radius)] border-2 border-dashed px-5 py-6 text-center transition-colors peer-focus-visible:outline-[length:var(--ph-focus-width)] peer-focus-visible:outline-solid peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--ph-accent)]', dragging ? 'border-[var(--ph-brand)] bg-[var(--ph-brand-soft)]' : 'border-stone-500 bg-stone-50 hover:bg-stone-100')}
              >
                <span className="text-base font-semibold text-stone-950">Drop a photo here, or choose one</span>
                <span className="text-sm text-stone-700">A clear photo of the face and body works best. JPEG, PNG, or WebP, under 10 MB. It stays on this device.</span>
              </label>
            )}
            {photoError && <p role="alert" className="text-sm font-semibold text-red-800">{photoError}</p>}
            {photoUrl && <Switch checked={data.wholePhoto} onChange={(event) => set('wholePhoto', event.target.checked)} label="Show the whole photo" hint="Off fills the frame and may crop the edges." />}
          </Card>

          <Card className="grid gap-4">
            <h2 className="text-xl font-semibold text-stone-950">Last seen</h2>
            <Field label="Where">{(a) => <Input {...a} placeholder="Near Maple St and 5th Ave" autoComplete="off" {...text('lastSeenWhere')} />}</Field>
            <Field label="Date">{(a) => <Input {...a} type="date" max={today || undefined} value={data.lastSeenWhen} onChange={(event) => set('lastSeenWhen', event.target.value)} />}</Field>
          </Card>

          <Card className="grid gap-4">
            <h2 className="text-xl font-semibold text-stone-950">How to reach you</h2>
            <Field label="Phone number" error={phoneError}>{(a) => <Input {...a} type="tel" autoComplete="tel" placeholder="(404) 555-0142" {...text('contactPhone')} onBlur={() => setTouched((current) => ({ ...current, phone: true }))} />}</Field>
            <Field label="Your name">{(a) => <Input {...a} autoComplete="name" {...text('contactName')} />}</Field>
            <Field label="Email" error={emailError}>{(a) => <Input {...a} type="email" autoComplete="email" {...text('contactEmail')} onBlur={() => setTouched((current) => ({ ...current, email: true }))} />}</Field>
          </Card>

          <Card className="grid gap-4">
            <h2 className="text-xl font-semibold text-stone-950">Finishing touches</h2>
            <Switch checked={data.reward} onChange={(event) => set('reward', event.target.checked)} label="Reward offered" hint="Adds a “Reward offered” badge. Do not put the amount on the flyer." />
            <Field label="Anything else people should know?" help="For example: friendly, shy with strangers, needs medicine.">{(a) => <Input {...a} placeholder="Friendly. Please call, do not chase." autoComplete="off" {...text('note')} />}</Field>
            <Switch checked={data.tabs} onChange={(event) => set('tabs', event.target.checked)} label="Tear-off tabs" hint="Eight cut-out strips along the bottom, each with your phone number or email." />
          </Card>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="primary" type="submit" className="max-lg:hidden">Print flyer</Button>
            <Button variant="primary" onClick={() => { setView('preview'); window.scrollTo({ top: 0 }); }} className="lg:hidden">See the flyer</Button>
            <Button variant="ghost" onClick={startOver}>Start over</Button>
          </div>
        </form>

        <section aria-labelledby="preview-heading" className={cx('fl-stage-wrap lg:sticky lg:top-6', view === 'edit' && 'max-lg:hidden')}>
          <div className="fl-screen mb-3 flex flex-wrap items-center gap-3">
            <h2 id="preview-heading" className="mr-auto text-xl font-semibold text-stone-950">Your flyer</h2>
            <Button variant="primary" onClick={print}>Print flyer</Button>
          </div>
          <div className="fl-screen mb-3 text-sm leading-6 text-stone-800" role="status">
            {overflowing
              ? <Notice tone="warning" title="There is more text than fits on one page.">Shorten the color, markings, or details and the flyer will fit.</Notice>
              : missing.length
                ? <p>It prints as it looks here. To make it more useful, {missing.slice(0, 3).join(', ').replace(/, ([^,]*)$/, missing.length > 1 ? ' and $1' : ' $1')}. You can print it anyway.</p>
                : <p>Looks ready. Choose <strong>Save as PDF</strong> in the print window to keep a copy, or print on letter paper.</p>}
          </div>
          <div className="fl-stage bg-stone-100">
            <div className="fl-paper" style={{ maxWidth: 'min(100%, max(16rem, calc((100dvh - 12rem) * 0.7727)))' }}>
              <div className="fl-frame"><Flyer data={data} photoUrl={photoUrl} onOverflow={setOverflowing} /></div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export const FlyerPage = () => <Providers><FlyerContent /></Providers>;
