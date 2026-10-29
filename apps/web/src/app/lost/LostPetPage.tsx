import type { ReactNode } from 'react';
import { SHELTER } from '@pawheaven/contracts/site';
import { Providers } from '../../lib/providers';
import { ButtonLink, Card, PageHeading, TextLink } from '../../ui';
import { ClockIcon, PinIcon } from '../../ui/icons';
import { PhotoSearch } from './PhotoSearch';

function Contact() {
  const { address } = SHELTER;
  return (
    <Card as="section" className="mt-8 border-[var(--ph-brand)] bg-[var(--ph-brand-soft)]">
      <h2 className="text-xl font-semibold text-stone-950">Call or visit first. It is the fastest way.</h2>
      <p className="mt-2 max-w-2xl text-base leading-7 text-stone-800">Our staff can look for your pet right away. Bring a photo if you can, and ask to walk through the kennels and cat rooms yourself.</p>
      <div className="mt-4 grid gap-5 sm:grid-cols-2">
        <div>
          <p className="flex items-center gap-2 font-semibold text-stone-950"><ClockIcon aria-hidden="true" /> Open hours</p>
          <dl className="mt-2 grid gap-1 text-base text-stone-800">
            {SHELTER.hours.map((row) => (
              <div key={row.days} className="flex flex-wrap justify-between gap-x-4"><dt>{row.days}</dt><dd className="font-medium">{row.open}</dd></div>
            ))}
          </dl>
          <p className="mt-2 text-sm text-stone-700">Times are Eastern time.</p>
        </div>
        <div>
          <p className="flex items-center gap-2 font-semibold text-stone-950"><PinIcon aria-hidden="true" /> Find us</p>
          <address className="mt-2 text-base not-italic leading-7 text-stone-800">
            {address.line1}<br />{address.city}, {address.state} {address.zip}
          </address>
          <div className="mt-3">
            <ButtonLink variant="primary" href={SHELTER.phoneHref}>Call {SHELTER.phone}</ButtonLink>
          </div>
        </div>
      </div>
    </Card>
  );
}

function Option({ number, id, title, speed, children }: { number: number; id: string; title: string; speed: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-6 border-t border-stone-300 pt-8">
      <p className="text-sm font-semibold text-[var(--ph-brand-strong)]">Option {number} <span aria-hidden="true">·</span> {speed}</p>
      <h2 id={`${id}-heading`} className="mt-1 text-2xl font-semibold tracking-tight text-stone-950">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function LostPetContent() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeading title="Lost a pet?" intro="We are sorry you are going through this. Here are three ways to look for your pet, from the quickest to the most thorough. You can do all of them." />
      <Contact />
      <nav aria-label="Ways to look for your pet" className="mt-8">
        <ol className="grid gap-1 text-base">
          <li><TextLink href="#check">1. Check if we have your pet</TextLink></li>
          <li><TextLink href="#flyer">2. Make a flyer</TextLink></li>
          <li><TextLink href="#report">3. Report a lost pet</TextLink></li>
        </ol>
      </nav>

      <div className="mt-8 grid gap-10">
        <Option number={1} id="check" title="Check if we have your pet" speed="Takes a few minutes">
          <PhotoSearch />
        </Option>

        <Option number={2} id="flyer" title="Make a flyer" speed="Takes about ten minutes">
          <p className="max-w-2xl text-base leading-7 text-stone-800">Fill in a template with your pet&apos;s photo and your phone number, then print it to put up around your neighborhood. Nothing is uploaded or saved: it all stays in your browser, and you do not need an account.</p>
          <div className="mt-4"><ButtonLink variant="secondary" href="/lost-pet/flyer">Make a printable flyer</ButtonLink></div>
        </Option>

        <Option number={3} id="report" title="Report a lost pet" speed="Keep going over the next days">
          <div className="grid max-w-2xl gap-5 text-base leading-7 text-stone-800">
            <p id="visit-often" className="scroll-mt-6">Animals can be moved or adopted, so a one-time check is not enough. These steps give your pet the best chance of coming home.</p>
            <ul className="grid gap-4">
              <li><strong className="text-stone-950">Visit often.</strong> Come in or call every day if you can, and look in person. Photos and descriptions can miss things you would recognize at once.</li>
              <li><strong className="text-stone-950">Bring a photo.</strong> A recent, clear picture helps staff and volunteers know who they are looking for. If your pet has a collar, tag, or marks, bring a note of what they look like.</li>
              <li><strong className="text-stone-950">Call your microchip company.</strong> If your pet is microchipped, tell the company that your pet is missing and make sure your phone number and address are up to date. A scanned chip only helps if the details are right.</li>
              <li><strong className="text-stone-950">Email the lost and found desk.</strong> Send a photo, your pet&apos;s name, where and when they went missing, and your phone number to <a className="font-medium text-[var(--ph-brand-strong)] underline underline-offset-4" href={`mailto:${SHELTER.lostAndFoundEmail}`}>{SHELTER.lostAndFoundEmail}</a>.</li>
              <li><strong className="text-stone-950">Tell the people around you.</strong> Talk to neighbors, nearby veterinary clinics, and other shelters. Put up your flyer where people will see it.</li>
            </ul>
          </div>
        </Option>
      </div>
    </div>
  );
}

export const LostPetPage = () => <Providers><LostPetContent /></Providers>;
