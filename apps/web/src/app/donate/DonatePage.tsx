import { useState } from 'react';
import type { PublicDonationsResponse } from '@pawheaven/contracts';
import { SHELTER } from '@pawheaven/contracts/site';
import { DONATE_URL, isTestDonateLink } from '../../lib/donate';
import { useApi } from '../../lib/fetch';
import { Card, Notice, PageHeading, buttonClass, cx } from '../../ui';
import { Providers } from '../../lib/providers';

const PRESETS = [25, 50, 100, 250] as const;

/** Stripe fills in the amount when the link allows people to choose what to pay; otherwise they type it there. */
const giftUrl = (amount: number | null) => (amount ? `${DONATE_URL}?prefilled_amount=${amount * 100}` : DONATE_URL);

const USES = [
  { title: 'Food and daily care', text: 'Meals, clean bedding, and the everyday supplies that keep each animal comfortable while they wait.' },
  { title: 'Vaccines and checkups', text: 'Vaccinations, parasite prevention, and health checks to keep the animals well.' },
  { title: 'Medical care', text: 'Treatment for animals who come in sick or hurt, so they can get healthy and go home.' },
] as const;

function SupporterWall() {
  const supporters = useApi<PublicDonationsResponse>('/public/donations', { staleSeconds: 60 });
  const donations = supporters.data?.donations ?? [];
  if (!donations.length) return null;
  return (
    <section aria-labelledby="supporters-heading" className="border-t border-stone-300 pt-6">
      <h2 id="supporters-heading" className="text-xl font-semibold text-stone-950">Recent generosity</h2>
      <p className="mt-2 text-base leading-7 text-stone-800">Thank you to the supporters who chose to share their gift.</p>
      <ul className="mt-4 grid gap-3" aria-live="polite">
        {donations.map((donation) => (
          <li key={`${donation.displayName}-${donation.createdAt}`} className="border border-stone-300 bg-white p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <p className="font-semibold text-stone-950">{donation.displayName}</p>
              <p className="font-semibold text-stone-950">{new Intl.NumberFormat(undefined, { style: 'currency', currency: donation.currency.toUpperCase() }).format(donation.amountCents / 100)}</p>
            </div>
            {donation.message && <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-stone-700">{donation.message}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function DonateContent() {
  const [amount, setAmount] = useState<number | null>(50);
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeading
        title="Help an animal get home"
        intro="Your gift helps us take care of the animals in our shelter until they find their families. Every amount helps, and every gift is appreciated."
      />

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:items-start">
        <Card className="min-w-0">
          <h2 id="gift-heading" className="text-xl font-semibold text-stone-950">Choose a gift</h2>
          {isTestDonateLink && (
            <Notice tone="warning" title="Test mode: no real money will move." className="mt-4">
              <span data-test-mode-notice>Use card number <span className="font-mono">4242 4242 4242 4242</span>, any future expiry date, any 3-digit security code, and any ZIP code.</span>
            </Notice>
          )}
          <fieldset className="mt-5 min-w-0">
            <legend className="text-sm font-semibold text-stone-950">Gift amount</legend>
            <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {PRESETS.map((preset) => (
                <label key={preset} className={cx('flex min-h-14 cursor-pointer items-center justify-center rounded-[var(--ph-radius)] border px-3 py-3 text-lg font-semibold text-stone-950 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2', amount === preset ? 'border-[var(--ph-brand)] bg-[var(--ph-brand-soft)]' : 'border-stone-400 bg-white hover:bg-stone-100')}>
                  <input type="radio" name="gift" className="sr-only" checked={amount === preset} onChange={() => setAmount(preset)} />
                  ${preset}
                </label>
              ))}
              <label className={cx('col-span-2 flex min-h-14 cursor-pointer items-center justify-center rounded-[var(--ph-radius)] border px-3 py-3 text-base font-semibold text-stone-950 has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 sm:col-span-4', amount === null ? 'border-[var(--ph-brand)] bg-[var(--ph-brand-soft)]' : 'border-stone-400 bg-white hover:bg-stone-100')}>
                <input type="radio" name="gift" className="sr-only" checked={amount === null} onChange={() => setAmount(null)} />
                Another amount
              </label>
            </div>
          </fieldset>
          <p role="status" className="mt-4 text-base text-stone-800">
            {amount ? `You chose $${amount}. ` : 'You will type your amount on the next page. '}
            You will confirm the amount on Stripe&apos;s secure page before you pay.
          </p>
          <a className={buttonClass('primary', 'mt-5 w-full whitespace-normal text-center text-lg sm:w-auto')} href={giftUrl(amount)} rel="noopener" data-donate-link>
            {amount ? `Give $${amount} securely with Stripe` : 'Donate securely with Stripe'}
          </a>

          <h3 className="mt-8 text-base font-semibold text-stone-950">What happens next</h3>
          <ol className="mt-2 grid gap-1.5 pl-5 text-base leading-7 text-stone-800 [list-style:decimal]">
            <li>You go to Stripe&apos;s secure checkout page.</li>
            <li>You enter your gift, your contact details, and your payment details there.</li>
            <li>When the payment goes through you come back to PawHeaven, and Stripe emails your receipt.</li>
          </ol>
          <p className="mt-6 border-t border-stone-200 pt-4 text-sm leading-6 text-stone-700">
            Payments are processed by Stripe. PawHeaven never sees or stores your card details. If a payment is declined or you close the page, nothing is charged and you can try again.
          </p>
        </Card>

        <div className="grid gap-6">
          <section aria-labelledby="uses-heading">
            <h2 id="uses-heading" className="text-xl font-semibold text-stone-950">What your gift does</h2>
            <p className="mt-2 text-base leading-7 text-stone-800">Gifts cover food, vaccines, and medical care for the animals staying with us. They help us look after each animal while they wait for a home.</p>
            <ul className="mt-4 grid gap-3">
              {USES.map((use) => (
                <li key={use.title} className="rounded-[var(--ph-radius)] border border-stone-300 bg-white p-4">
                  <p className="font-semibold text-stone-950">{use.title}</p>
                  <p className="mt-1 text-base leading-7 text-stone-800">{use.text}</p>
                </li>
              ))}
            </ul>
          </section>
          <section aria-labelledby="other-heading" className="rounded-[var(--ph-radius)] border border-stone-300 bg-stone-50 p-5">
            <h2 id="other-heading" className="text-lg font-semibold text-stone-950">Other ways to help</h2>
            <p className="mt-2 text-base leading-7 text-stone-800">Not able to give right now? You can still make a difference.</p>
            <ul className="mt-3 grid gap-1 text-base">
              <li><a className="inline-block py-1.5 font-medium text-[var(--ph-brand-strong)] underline underline-offset-4" href="/adopt">Adopt an animal</a></li>
              <li><a className="inline-block py-1.5 font-medium text-[var(--ph-brand-strong)] underline underline-offset-4" href="/foster">Foster an animal</a></li>
              <li><a className="inline-block py-1.5 font-medium text-[var(--ph-brand-strong)] underline underline-offset-4" href="/volunteer">Volunteer your time</a></li>
            </ul>
            <p className="mt-3 text-sm leading-6 text-stone-700">Questions about giving? Email <a className="font-medium underline underline-offset-4" href={`mailto:${SHELTER.email}`}>{SHELTER.email}</a> or call <a className="font-medium underline underline-offset-4" href={SHELTER.phoneHref}>{SHELTER.phone}</a>.</p>
          </section>
          <SupporterWall />
        </div>
      </div>
    </div>
  );
}

export const DonatePage = () => <Providers><DonateContent /></Providers>;
