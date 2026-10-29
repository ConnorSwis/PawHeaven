import { useEffect, useMemo, useRef, useState } from 'react';
import { QUIZ_QUESTIONS, QUIZ_TRAITS, matchStrength, type FieldErrors, type LatestQuizResponse, type QuizAnswers, type QuizResultResponse, type QuizTrait } from '@pawheaven/contracts';
import { ApiRequestError, api, errorMessage, loginUrl, useApi, useMe } from '../../lib/fetch';
import { Providers } from '../../lib/providers';
import { Badge, Button, ButtonLink, Choice, EmptyState, ErrorSummary, Fieldset, Field, Notice, PageHeading, Stepper, Textarea, TextLink } from '../../ui';
import { AnimalCard, AnimalCardSkeleton } from './AnimalCard';
import { ClientOnly } from './client';

type QuestionKey = keyof typeof QUIZ_QUESTIONS;
const QUESTION_KEYS = Object.keys(QUIZ_QUESTIONS) as QuestionKey[];
const LAST_STEP = QUESTION_KEYS.length; // the traits and notes step
const STORE = 'ph-quiz';

type Draft = { answers: Partial<Record<QuestionKey, string>>; traits: QuizTrait[]; notes: string };
type Phase = 'questions' | 'signin' | 'working' | 'results';
type Stored = { draft: Draft; step: number; pending: boolean };

const EMPTY: Draft = { answers: {}, traits: [], notes: '' };

function loadStored(): Stored | null {
  try {
    const parsed = JSON.parse(window.sessionStorage.getItem(STORE) ?? 'null') as Stored | null;
    return parsed?.draft ? parsed : null;
  } catch { return null; }
}
function saveStored(value: Stored | null) {
  try { if (value) window.sessionStorage.setItem(STORE, JSON.stringify(value)); else window.sessionStorage.removeItem(STORE); } catch { /* Private mode: answers just are not kept across the sign-in. */ }
}
const draftFromAnswers = (answers: QuizAnswers): Draft => ({ answers: Object.fromEntries(QUESTION_KEYS.map((key) => [key, answers[key]])), traits: answers.traits, notes: answers.notes });

function problemsFor(draft: Draft): { field: string; message: string }[] {
  const problems: { field: string; message: string }[] = QUESTION_KEYS.filter((key) => !draft.answers[key]).map((key) => ({ field: key, message: `Choose an answer for: ${QUIZ_QUESTIONS[key].label}` }));
  if (!draft.traits.length) problems.push({ field: 'traits', message: 'Choose at least one trait you want in a pet.' });
  else if (draft.traits.length > 3) problems.push({ field: 'traits', message: 'Choose up to three traits.' });
  return problems;
}

function friendlyError(error: unknown): string {
  if (error instanceof ApiRequestError) {
    if (error.status === 429) return error.message || 'You have taken the quiz several times today. Please try again tomorrow, or browse the animals yourself.';
    if (error.status === 503) return 'Matching is not available right now. Please try again later, or browse the animals yourself.';
    if (error.status === 502) return 'We could not finish matching just now. Please try again in a minute.';
  }
  return errorMessage(error, 'We could not find matches right now. Please try again.');
}

function Results({ result, onRetake }: { result: QuizResultResponse; onRetake: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <section aria-labelledby="quiz-results">
      <h2 id="quiz-results" ref={heading} tabIndex={-1} className="text-2xl font-semibold tracking-tight text-stone-950 focus:outline-none">{result.recommendations.length ? 'Your matches' : 'No matches right now'}</h2>
      {result.recommendations.length > 0 ? (
        <>
          <p className="mt-2 max-w-3xl text-base leading-7 text-stone-800">These animals could suit your home and lifestyle, best fit first. Suggestions come from an AI model. They are a starting point, not a decision, and they do not reserve an animal or start an application.</p>
          <ol className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {result.recommendations.map((item) => (
              <li key={item.pet.id} className="flex">
                <div className="flex w-full flex-col">
                  <AnimalCard pet={item.pet}>
                    <div className="mt-1 border-t border-stone-200 pt-3">
                      <Badge tone={matchStrength(item.score) === 'Possible' ? 'neutral' : 'good'}>{matchStrength(item.score)} match</Badge>
                      <p className="mt-2 text-sm leading-6 text-stone-900">{item.reason}</p>
                    </div>
                  </AnimalCard>
                </div>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <div className="mt-4 rounded-[var(--ph-radius)] border border-dashed border-stone-400 bg-white">
          <EmptyState title="Nothing fits those answers right now" action={<ButtonLink className="mt-3" variant="primary" href="/adopt">Browse all animals</ButtonLink>}>{result.notice ?? 'Animals arrive often. Try changing an answer, or browse everyone who is here today.'}</EmptyState>
        </div>
      )}
      <div className="mt-8 flex flex-wrap gap-3">
        <Button onClick={onRetake}>Retake the quiz</Button>
        {result.recommendations.length > 0 && <ButtonLink href="/adopt">Browse all animals</ButtonLink>}
      </div>
    </section>
  );
}

function QuizApp() {
  const me = useMe();
  const stored = useMemo(loadStored, []);
  const [draft, setDraft] = useState<Draft>(stored?.draft ?? EMPTY);
  const [step, setStep] = useState(stored?.pending ? LAST_STEP : Math.min(stored?.step ?? 0, LAST_STEP));
  const [phase, setPhase] = useState<Phase>('questions');
  const [result, setResult] = useState<QuizResultResponse | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [serverError, setServerError] = useState('');
  const pending = useRef(Boolean(stored?.pending));
  const group = useRef<HTMLFieldSetElement>(null);
  const first = useRef(true);
  const signedIn = Boolean(me.data);
  const latest = useApi<LatestQuizResponse>(signedIn ? '/quiz/latest' : null);

  useEffect(() => { saveStored(phase === 'results' ? null : { draft, step, pending: phase === 'signin' || pending.current }); }, [draft, step, phase]);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    group.current?.focus();
  }, [step, phase]);

  async function submit(current: Draft) {
    setServerError('');
    setErrors([]);
    setPhase('working');
    pending.current = false;
    try {
      const answers = { ...current.answers, traits: current.traits, notes: current.notes.trim() } as QuizAnswers;
      const response = await api<QuizResultResponse>('/quiz', { method: 'POST', json: answers });
      setResult(response);
      setPhase('results');
    } catch (error) {
      if (error instanceof ApiRequestError && error.status === 401) {
        pending.current = true;
        setPhase('signin');
        return;
      }
      if (error instanceof ApiRequestError && error.fieldErrors) setErrors(Object.values(error.fieldErrors as FieldErrors));
      setServerError(friendlyError(error));
      setStep(LAST_STEP);
      setPhase('questions');
    }
  }

  // Coming back from signing in: the saved answers are sent without asking again.
  useEffect(() => {
    if (!pending.current || !me.isSuccess) return;
    if (me.data) void submit(draft); else setPhase('signin');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.isSuccess, me.data]);

  const answered = (key: QuestionKey) => Boolean(draft.answers[key]);
  const next = () => {
    setServerError('');
    if (step < LAST_STEP) {
      const key = QUESTION_KEYS[step];
      if (!answered(key)) { setErrors([`Choose an answer to continue: ${QUIZ_QUESTIONS[key].label}`]); return; }
      setErrors([]);
      setStep(step + 1);
      return;
    }
    const problems = problemsFor(draft);
    if (problems.length) {
      setErrors(problems.map((problem) => problem.message));
      const firstProblem = problems[0].field;
      if (firstProblem !== 'traits') setStep(QUESTION_KEYS.indexOf(firstProblem as QuestionKey));
      return;
    }
    setErrors([]);
    if (signedIn) void submit(draft);
    else if (me.isLoading) { pending.current = true; setPhase('working'); }
    else { pending.current = true; setPhase('signin'); }
  };
  const back = () => { setErrors([]); setServerError(''); if (phase === 'signin') { setPhase('questions'); return; } setStep(Math.max(0, step - 1)); };
  const retake = () => { setDraft(result ? draftFromAnswers(result.answers) : EMPTY); setResult(null); setStep(0); setPhase('questions'); };
  const showLatest = () => { if (latest.data?.result) { setResult(latest.data.result); setPhase('results'); } };

  const steps = signedIn ? ['Questions', 'Your matches'] : ['Questions', 'Sign in', 'Your matches'];
  const current = phase === 'questions' ? 0 : phase === 'signin' ? 1 : steps.length - 1;
  const key = QUESTION_KEYS[step];

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      <PageHeading title="Find your match" intro="Answer a few questions about your home and lifestyle. We compare your answers with the animals who are here now and explain why each could fit." />
      <div className="mt-6"><Stepper steps={steps} current={current} /></div>

      {phase === 'questions' && step === 0 && latest.data?.result && (
        <Notice className="mt-6" title="You have taken the quiz before">
          <Button className="mt-2" onClick={showLatest}>See my last matches</Button>
        </Notice>
      )}

      {phase === 'questions' && (
        <form className="mt-8" noValidate onSubmit={(event) => { event.preventDefault(); next(); }}>
          <p className="text-sm font-medium text-stone-700" aria-hidden="true">{step < LAST_STEP ? `Question ${step + 1} of ${LAST_STEP + 1}` : `Question ${LAST_STEP + 1} of ${LAST_STEP + 1}`}</p>
          <div className="mt-1 h-1.5 w-full bg-stone-200" aria-hidden="true"><div className="h-full bg-[var(--ph-brand)] transition-all" style={{ width: `${((step + 1) / (LAST_STEP + 1)) * 100}%` }} /></div>
          <div className="mt-5 grid gap-4">
            <ErrorSummary errors={errors} />
            {serverError && <Notice tone="error">{serverError}</Notice>}
          </div>

          {step < LAST_STEP ? (
            <fieldset ref={group} tabIndex={-1} className="mt-5 border-0 p-0 focus:outline-none" key={key}>
              <legend className="mb-3 text-2xl font-semibold tracking-tight text-stone-950">{QUIZ_QUESTIONS[key].label}</legend>
              <div className="grid gap-2">
                {Object.entries(QUIZ_QUESTIONS[key].options).map(([value, label]) => (
                  <Choice key={value} type="radio" name={key} value={value} label={label} checked={draft.answers[key] === value} onChange={() => { setErrors([]); setDraft((d) => ({ ...d, answers: { ...d.answers, [key]: value } })); }} />
                ))}
              </div>
            </fieldset>
          ) : (
            <fieldset ref={group} tabIndex={-1} className="mt-5 grid gap-6 border-0 p-0 focus:outline-none">
              <legend className="mb-3 text-2xl font-semibold tracking-tight text-stone-950">What matters most in a pet?</legend>
              <Fieldset legend="Traits you would like. Choose up to three." help={`${draft.traits.length} chosen`}>
                {(Object.entries(QUIZ_TRAITS) as [QuizTrait, string][]).map(([value, label]) => (
                  <Choice key={value} label={label} value={value} checked={draft.traits.includes(value)} onChange={(event) => { setErrors([]); setDraft((d) => ({ ...d, traits: event.target.checked ? [...d.traits, value] : d.traits.filter((trait) => trait !== value) })); }} />
                ))}
              </Fieldset>
              <Field label="Anything else we should know? (optional)" help="Your answers are sent to an AI provider to find matches, and your latest result is saved to your account. Please leave out anything sensitive.">
                {(aria) => <Textarea {...aria} name="notes" maxLength={500} rows={3} value={draft.notes} onChange={(event) => { setErrors([]); setDraft((d) => ({ ...d, notes: event.target.value })); }} />}
              </Field>
            </fieldset>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            {step > 0 && <Button onClick={back}>Back</Button>}
            <Button type="submit" variant="primary">{step < LAST_STEP ? 'Next' : signedIn ? 'Show my matches' : 'Next: see my matches'}</Button>
          </div>
        </form>
      )}

      {phase === 'signin' && (
        <section ref={group as unknown as React.RefObject<HTMLElement>} tabIndex={-1} aria-labelledby="quiz-signin" className="mt-8 rounded-[var(--ph-radius)] border border-stone-300 bg-white p-6 focus:outline-none">
          <h2 id="quiz-signin" className="text-2xl font-semibold tracking-tight text-stone-950">Sign in to see your matches</h2>
          <p className="mt-3 text-base leading-7 text-stone-800">Your answers are saved on this device. Sign in or create a free account and we will bring you straight back to see your matches. We save your latest result to your account so you can find it again.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink variant="primary" href={loginUrl('/adopt/match')}>Sign in</ButtonLink>
            <ButtonLink href={`/sign-up?next=${encodeURIComponent('/adopt/match')}`}>Create an account</ButtonLink>
            <Button variant="ghost" onClick={back}>Back to my answers</Button>
          </div>
          <p className="mt-4 text-sm text-stone-700">Just looking? <TextLink href="/adopt">Browse all animals</TextLink> without signing in.</p>
        </section>
      )}

      {phase === 'working' && (
        <div className="mt-8" role="status" aria-live="polite">
          <p className="text-lg font-semibold text-stone-950">Finding your matches. This can take up to half a minute.</p>
          <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }, (_, index) => <AnimalCardSkeleton key={index} />)}</div>
        </div>
      )}

      {phase === 'results' && result && <div className="mt-8"><Results result={result} onRetake={retake} /></div>}
    </div>
  );
}

export default function Quiz() {
  return (
    <Providers>
      <ClientOnly fallback={<div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12"><PageHeading title="Find your match" intro="Answer a few questions about your home and lifestyle. We compare your answers with the animals who are here now and explain why each could fit." /><div className="mt-8 h-64 animate-pulse bg-stone-200" aria-hidden="true" /></div>}>
        <QuizApp />
      </ClientOnly>
    </Providers>
  );
}
