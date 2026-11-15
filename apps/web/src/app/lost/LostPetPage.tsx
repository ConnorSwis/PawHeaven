import type { ReactNode } from 'react';
import { SHELTER } from '@pawheaven/contracts/site';
import { Providers } from '../../lib/providers';
import { ButtonLink, Card, IconTile, PageHero, Section, SectionHeader, TextLink } from '../../ui';
import { ArrowRightIcon, ClockIcon, InfoIcon, PawIcon, PhoneIcon, PinIcon, SearchIcon } from '../../ui/icons';
import { PhotoSearch } from './PhotoSearch';

function Contact() {
  const { address } = SHELTER;
  return (
    <Section labelledBy="contact-heading" innerClassName="py-0 sm:py-0">
      <Card as="div" className="border-[var(--ph-brand)] bg-[var(--ph-brand-soft)] p-6 sm:p-8">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr_1fr]">
          <div>
            <h2 id="contact-heading" className="text-xl font-bold text-stone-950">Call or visit first. It is the fastest way.</h2>
            <p className="mt-2 text-base leading-7 text-stone-800">Our staff can look for your pet right away. Bring a photo if you can, and ask to walk through the kennels and cat rooms yourself.</p>
            <a href={SHELTER.phoneHref} className="mt-4 inline-flex min-h-11 items-center gap-2 text-2xl font-bold tracking-tight text-stone-950 underline decoration-stone-500 underline-offset-4 hover:decoration-stone-950"><PhoneIcon aria-hidden="true" />{SHELTER.phone}</a>
          </div>
          <div>
            <p className="flex items-center gap-2 font-bold text-stone-950"><ClockIcon aria-hidden="true" /> Open hours</p>
            <dl className="mt-2 grid gap-1 text-base text-stone-800">
              {SHELTER.hours.map((row) => (
                <div key={row.days} className="flex flex-wrap justify-between gap-x-4"><dt>{row.days}</dt><dd className="font-semibold text-stone-950">{row.open}</dd></div>
              ))}
            </dl>
            <p className="mt-2 text-sm text-stone-700">Times are Eastern time.</p>
          </div>
          <div>
            <p className="flex items-center gap-2 font-bold text-stone-950"><PinIcon aria-hidden="true" /> Find us</p>
            <address className="mt-2 text-base not-italic leading-7 text-stone-800">
              {address.line1}<br />{address.city}, {address.state} {address.zip}
            </address>
          </div>
        </div>
      </Card>
    </Section>
  );
}

const CHOICES = [
  { href: '#check', icon: SearchIcon, title: 'Check if we have your pet', text: 'Compare your pet’s photos with the animals in our care.', time: 'Takes a few minutes' },
  { href: '#flyer', icon: PawIcon, title: 'Make a flyer', text: 'Fill in a template and print it to put up around your neighborhood.', time: 'Takes about ten minutes' },
  { href: '#report', icon: InfoIcon, title: 'Report a lost pet', text: 'What to do over the next days to give your pet the best chance of coming home.', time: 'Keep going over the next days' },
] as const;

function Choices() {
  return (
    <Section tone="tint" labelledBy="choices-heading">
      <SectionHeader id="choices-heading" title="Three ways to look for your pet" intro="From the quickest to the most thorough. You can do all of them." />
      <ol className="mt-8 grid gap-5 md:grid-cols-3">
        {CHOICES.map((choice, index) => (
          <li key={choice.href}>
            <Card as="div" className="relative flex h-full flex-col gap-3 p-6 hover:bg-stone-50 sm:p-7">
              <div className="flex items-center gap-3">
                <IconTile size="lg"><choice.icon width={26} height={26} /></IconTile>
                <span className="text-sm font-bold text-stone-700">Option {index + 1}</span>
              </div>
              <h3 className="text-xl font-semibold text-stone-950"><a href={choice.href} className="after:absolute after:inset-0 after:rounded-[var(--ph-radius)] hover:underline hover:underline-offset-4">{choice.title}</a></h3>
              <p className="flex-1 text-base leading-7 text-stone-800">{choice.text}</p>
              <p className="flex items-center justify-between gap-2 text-sm font-semibold text-stone-800">{choice.time}<ArrowRightIcon aria-hidden="true" width={18} height={18} /></p>
            </Card>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function Option({ number, id, title, speed, tone, children }: { number: number; id: string; title: string; speed: string; tone: 'page' | 'tint'; children: ReactNode }) {
  return (
    <Section id={id} tone={tone} labelledBy={`${id}-heading`} className="scroll-mt-4">
      <div className="max-w-3xl">
        <p className="text-sm font-bold text-[var(--ph-brand-strong)]">Option {number} <span aria-hidden="true">·</span> {speed}</p>
        <h2 id={`${id}-heading`} className="mt-1 text-2xl font-bold tracking-tight text-stone-950 sm:text-3xl">{title}</h2>
      </div>
      <div className="mt-5">{children}</div>
    </Section>
  );
}

const STEPS: { lead: string; body: ReactNode }[] = [
  { lead: 'Visit often.', body: 'Come in or call every day if you can, and look in person. Photos and descriptions can miss things you would recognize at once.' },
  { lead: 'Bring a photo.', body: 'A recent, clear picture helps staff and volunteers know who they are looking for. If your pet has a collar, tag, or marks, bring a note of what they look like.' },
  { lead: 'Call your microchip company.', body: 'If your pet is microchipped, tell the company that your pet is missing and make sure your phone number and address are up to date. A scanned chip only helps if the details are right.' },
  { lead: 'Email the lost and found desk.', body: <>Send a photo, your pet&apos;s name, where and when they went missing, and your phone number to <TextLink href={`mailto:${SHELTER.lostAndFoundEmail}`}>{SHELTER.lostAndFoundEmail}</TextLink>.</> },
  { lead: 'Tell the people around you.', body: 'Talk to neighbors, nearby veterinary clinics, and other shelters. Put up your flyer where people will see it.' },
];

function LostPetContent() {
  return (
    <>
      <PageHero
        id="lost-title"
        eyebrow="Lost a pet?"
        title="We will help you look for your pet."
        intro="We are sorry you are going through this. Here are three ways to look, from the quickest to the most thorough. You can do all of them."
        actions={<><ButtonLink variant="primary" href={SHELTER.phoneHref}><PhoneIcon aria-hidden="true" width={18} height={18} />Call {SHELTER.phone}</ButtonLink><ButtonLink href="#check">Check by photo</ButtonLink></>}
        className="[&>div]:pb-8 lg:[&>div]:pb-8"
      />
      <Contact />
      <Choices />

      <Option number={1} id="check" title="Check if we have your pet" speed="Takes a few minutes" tone="page">
        <PhotoSearch />
      </Option>

      <Option number={2} id="flyer" title="Make a flyer" speed="Takes about ten minutes" tone="tint">
        <p className="max-w-2xl text-base leading-7 text-stone-800">Fill in a template with your pet&apos;s photo and your phone number, then print it to put up around your neighborhood. Nothing is uploaded or saved: it all stays in your browser, and you do not need an account.</p>
        <div className="mt-5"><ButtonLink variant="primary" href="/lost-pet/flyer">Make a printable flyer</ButtonLink></div>
      </Option>

      <Option number={3} id="report" title="Report a lost pet" speed="Keep going over the next days" tone="page">
        <p id="visit-often" className="max-w-2xl scroll-mt-6 text-base leading-7 text-stone-800">Animals can be moved or adopted, so a one-time check is not enough. These steps give your pet the best chance of coming home.</p>
        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {STEPS.map((step) => (
            <li key={step.lead} className="min-w-0"><Card as="div" className="h-full p-5 sm:p-5"><p className="text-base font-bold text-stone-950">{step.lead}</p><p className="mt-1.5 text-base leading-7 text-stone-800 [overflow-wrap:anywhere]">{step.body}</p></Card></li>
          ))}
        </ul>
      </Option>
    </>
  );
}

export const LostPetPage = () => <Providers><LostPetContent /></Providers>;
