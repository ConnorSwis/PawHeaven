import { useEffect, useMemo, useRef, useState } from 'react';
import { Providers } from '../../lib/providers';
import { useMe } from '../../lib/fetch';
import { Button, Card, ErrorSummary, Field, Input, PageHeading, TextLink } from '../../ui';

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

const FIELDS = [
  { name: 'species', label: 'Kind of animal', required: true, placeholder: 'Dog, cat, rabbit…', max: 40 },
  { name: 'petName', label: 'Pet’s name', required: false, placeholder: 'Biscuit', max: 60 },
  { name: 'breed', label: 'Breed', required: false, placeholder: 'Beagle mix', max: 80 },
  { name: 'appearance', label: 'Color, size, and markings', required: true, placeholder: 'Brown and white, medium size, white patch on the chest', max: 200 },
  { name: 'distinguishing', label: 'Collar, microchip, or other identifying details', required: false, placeholder: 'Red collar, microchipped, limps slightly on the left rear leg', max: 200 },
  { name: 'lastSeenWhere', label: 'Last seen where', required: true, placeholder: 'Near Maple St and 5th Ave', max: 120 },
  { name: 'lastSeenWhen', label: 'Last seen on', required: true, placeholder: '', max: 20, type: 'date' },
  { name: 'contactName', label: 'Your name', required: true, placeholder: '', max: 60, autoComplete: 'name' },
  { name: 'contactPhone', label: 'Phone number', required: true, placeholder: '(404) 555-0142', max: 30, type: 'tel', autoComplete: 'tel' },
  { name: 'contactEmail', label: 'Email', required: false, placeholder: '', max: 100, type: 'email', autoComplete: 'email' },
  { name: 'note', label: 'Extra note, such as a reward', required: false, placeholder: 'Reward offered. Please call, do not chase.', max: 120 },
] as const;
type FieldName = (typeof FIELDS)[number]['name'];
type Values = Record<FieldName, string>;
const EMPTY = Object.fromEntries(FIELDS.map((field) => [field.name, ''])) as Values;

function problemsFor(values: Values): Partial<Record<FieldName, string>> {
  const found: Partial<Record<FieldName, string>> = {};
  for (const field of FIELDS) if (field.required && !values[field.name].trim()) found[field.name] = 'This is needed on the flyer.';
  if (values.contactPhone.trim() && values.contactPhone.replace(/\D/g, '').length < 10) found.contactPhone = 'Enter a phone number with at least 10 digits.';
  if (values.contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.contactEmail.trim())) found.contactEmail = 'Enter an email address like name@example.com.';
  return found;
}

function Line({ label, text }: { label: string; text: string }) {
  return <p className="mt-1.5 text-base leading-snug"><span className="font-bold">{label}: </span>{text}</p>;
}

/** The sheet that gets printed. */
function Flyer({ values, photoUrl }: { values: Values; photoUrl: string | null }) {
  const v = (name: FieldName) => values[name].trim();
  const when = v('lastSeenWhen') ? new Date(`${v('lastSeenWhen')}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '';
  return (
    <article id="lost-pet-flyer" aria-label="Flyer preview" className="mx-auto aspect-[8.5/11] w-full max-w-[34rem] overflow-hidden border-2 border-stone-900 bg-white p-6 text-stone-950">
      <div className="flex h-full flex-col">
        <p className="text-center text-5xl font-black uppercase leading-none tracking-tight">Lost</p>
        <p className="mt-1 text-center text-2xl font-extrabold uppercase">{v('species') || 'pet'}</p>
        {v('petName') && <p className="mt-2 text-center text-3xl font-bold">Answers to “{v('petName')}”</p>}
        {photoUrl && (
          <div className="mt-4 flex min-h-[5rem] flex-1 items-center justify-center overflow-hidden">
            <img src={photoUrl} alt="Photo of the lost pet" className="max-h-full max-w-full border border-stone-400 object-contain" />
          </div>
        )}
        <div className="mt-3">
          {v('breed') && <Line label="Breed" text={v('breed')} />}
          {v('appearance') && <Line label="Looks like" text={v('appearance')} />}
          {v('distinguishing') && <Line label="Identifying details" text={v('distinguishing')} />}
          {v('lastSeenWhere') && <Line label="Last seen" text={`${v('lastSeenWhere')}${when ? `, ${when}` : ''}`} />}
        </div>
        {v('note') && <p className="mt-2 text-center text-lg font-bold">{v('note')}</p>}
        <div className="mt-auto border-t-4 border-stone-950 pt-3 text-center">
          <p className="text-base font-bold uppercase">If you have seen this pet, please call</p>
          <p className="mt-1 text-3xl font-black">{v('contactPhone') || '(phone number)'}</p>
          <p className="mt-1 text-base">{[v('contactName'), v('contactEmail')].filter(Boolean).join(' · ') || '(your name)'}</p>
        </div>
      </div>
    </article>
  );
}

function FlyerContent() {
  const me = useMe();
  const [values, setValues] = useState<Values>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [summary, setSummary] = useState<string[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState('');
  const [photoName, setPhotoName] = useState('');
  const [today, setToday] = useState('');
  const inputs = useRef(new Map<FieldName, HTMLInputElement>());
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => setToday(new Date().toISOString().slice(0, 10)), []);
  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl); }, [photoUrl]);

  // Fill in the contact details from the account once, without overwriting anything typed.
  useEffect(() => {
    const user = me.data;
    if (!user) return;
    setValues((current) => ({ ...current, contactName: current.contactName || user.name }));
  }, [me.data]);

  const ready = useMemo(() => Object.keys(problemsFor(values)).length === 0, [values]);

  function onPhoto(file: File | undefined) {
    setPhotoError('');
    if (!file) { setPhotoUrl(null); setPhotoName(''); return; }
    if (!PHOTO_TYPES.includes(file.type) || file.size > MAX_PHOTO_BYTES) {
      setPhotoError('Choose a JPEG, PNG, or WebP photo smaller than 10 MB.');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    setPhotoName(file.name);
    setPhotoUrl(URL.createObjectURL(file));
  }

  function print() {
    const found = problemsFor(values);
    setErrors(found);
    const first = FIELDS.find((field) => found[field.name]);
    if (first) {
      setSummary(FIELDS.flatMap((field) => (found[field.name] ? [`${field.label}: ${found[field.name]}`] : [])));
      inputs.current.get(first.name)?.focus();
      return;
    }
    setSummary([]);
    window.print();
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
      <style>{PRINT_CSS}</style>
      <div className="flyer-controls">
        <PageHeading title="Make a lost-pet flyer" intro="Fill in the template, check the preview, and print a flyer to put up in your neighborhood. Everything stays in your browser: nothing here is uploaded or saved." />
        <p className="mt-3 text-sm text-stone-700"><TextLink href="/lost-pet">Back to lost a pet?</TextLink></p>
        <Card className="mt-6">
          <form className="grid gap-4" noValidate onSubmit={(event) => { event.preventDefault(); print(); }}>
            <ErrorSummary errors={summary} title="Please fill in these details" />
            {FIELDS.map((field) => (
              <Field key={field.name} label={field.label} required={field.required} error={errors[field.name]}>
                {(a) => (
                  <Input
                    {...a}
                    ref={(node) => { if (node) inputs.current.set(field.name, node); else inputs.current.delete(field.name); }}
                    name={field.name}
                    type={'type' in field ? field.type : 'text'}
                    autoComplete={'autoComplete' in field ? field.autoComplete : 'off'}
                    maxLength={field.max}
                    placeholder={field.placeholder || undefined}
                    max={field.name === 'lastSeenWhen' ? today || undefined : undefined}
                    value={values[field.name]}
                    onChange={(event) => { setValues((current) => ({ ...current, [field.name]: event.target.value })); setErrors((current) => ({ ...current, [field.name]: undefined })); setSummary([]); }}
                  />
                )}
              </Field>
            ))}
            <Field label="Photo of your pet" help={photoName ? `Using ${photoName}. Choose another file to replace it.` : 'A JPEG, PNG, or WebP photo smaller than 10 MB. It stays on this device.'} error={photoError || undefined}>
              {(a) => <input {...a} ref={fileRef} type="file" accept={PHOTO_TYPES.join(',')} onChange={(event) => onPhoto(event.target.files?.[0])} className="block w-full min-h-11 rounded-[var(--ph-radius)] border border-stone-500 bg-white p-2 text-base text-stone-950 file:mr-3 file:min-h-9 file:rounded-[var(--ph-radius)] file:border-0 file:bg-stone-200 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-stone-950" />}
            </Field>
          </form>
        </Card>
      </div>
      <section aria-labelledby="preview-heading">
        <div className="flyer-controls mb-4 flex flex-wrap items-center gap-3">
          <h2 id="preview-heading" className="mr-auto text-xl font-semibold text-stone-950">Preview</h2>
          <Button variant="primary" onClick={print}>Print flyer</Button>
        </div>
        <p role="status" className="flyer-controls mb-3 text-sm text-stone-800">{ready ? 'Ready to print.' : 'The preview updates as you type. Fill in the required details before printing.'}</p>
        <Flyer values={values} photoUrl={photoUrl} />
      </section>
    </div>
  );
}

/*
 * A printed flyer is always dark text on white, whatever the site theme is. These keyword colors
 * are the one deliberate exception to "colors come from the theme": the sheet must stay readable
 * on paper and on a black-and-white printer.
 */
const PRINT_CSS = `
  #lost-pet-flyer {
    --color-white: white;
    --color-stone-400: gray;
    --color-stone-900: black;
    --color-stone-950: black;
    color: black;
    background: white;
  }
  @media print {
    @page { size: letter portrait; margin: 0.4in; }
    body * { visibility: hidden !important; }
    #lost-pet-flyer, #lost-pet-flyer * { visibility: visible !important; }
    #lost-pet-flyer { position: absolute; inset: 0; width: 100%; max-width: none; margin: 0; border: 0; padding: 0; aspect-ratio: auto; }
  }
`;

export const FlyerPage = () => <Providers><FlyerContent /></Providers>;
