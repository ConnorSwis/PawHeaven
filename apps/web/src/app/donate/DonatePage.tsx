import { useState } from 'react';
import type { PublicDonationsResponse } from '@pawheaven/contracts';
import { SHELTER } from '@pawheaven/contracts/site';
import { DONATE_URL, isTestDonateLink } from '../../lib/donate';
import { useApi } from '../../lib/fetch';
import { ButtonLink, Card, IconTile, Notice, PageHero, Section, SectionHeader, TextLink, buttonClass, cx } from '../../ui';
import { CheckIcon, HeartIcon, HomeIcon, PawIcon, ShieldCheckIcon, UsersIcon } from '../../ui/icons';
import { Providers } from '../../lib/providers';

const PRESETS = [25, 50, 100, 250] as const;

/** Stripe fills in the amount when the link allows people to choose what to pay; otherwise they type it there. */
const giftUrl = (amount: number | null) => (amount ? `${DONATE_URL}?prefilled_amount=${amount * 100}` : DONATE_URL);

const USES = [
  { title: 'Food and daily care', text: 'Meals, clean bedding, and the everyday supplies that keep each animal comfortable while they wait.', icon: HomeIcon },
  { title: 'Vaccines and checkups', text: 'Vaccinations, parasite prevention, and health checks to keep the animals well.', icon: ShieldCheckIcon },
  { title: 'Medical care', text: 'Treatment for animals who come in sick or hurt, so they can get healthy and go home.', icon: HeartIcon },
] as const;

const pill = 'relative flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-[var(--ph-radius-pill)] border px-4 py-3 font-bold shadow-sm transition-colors has-[:focus-visible]:outline-[length:var(--ph-focus-width)] has-[:focus-visible]:outline-solid has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--ph-accent)]';
const pillState = (on: boolean) => (on ? 'border-[var(--ph-brand)] bg-[var(--ph-brand)] text-[var(--ph-on-brand)]' : 'border-stone-400 bg-white text-stone-950 hover:bg-stone-100');

function SupporterWall() {
  const supporters = useApi<PublicDonationsResponse>('/public/donations', { staleSeconds: 60 });
  const donations = supporters.data?.donations ?? [];
  if (!donations.length) return null;
  return (
    <Section tone="tint" labelledBy="supporters-heading">
      <SectionHeader id="supporters-heading" title="Recent generosity" intro="Thank you to the supporters who chose to share their gift." />
      <ul className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3" aria-live="polite">
        {donations.map((donation) => (
          <li key={`${donation.displayName}-${donation.createdAt}`}>
            <Card as="div" className="flex h-full gap-4 p-5 sm:p-5">
              <IconTile size="sm"><PawIcon width={18} height={18} /></IconTile>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <p className="font-bold text-stone-950">{donation.displayName}</p>
                  <p className="font-bold text-[var(--ph-brand-strong)]">{new Intl.NumberFormat(undefined, { style: 'currency', currency: donation.currency.toUpperCase() }).format(donation.amountCents / 100)}</p>
                </div>
                {donation.message && <p className="mt-2 whitespace-pre-wrap text-base leading-7 text-stone-800">{donation.message}</p>}
              </div>
            </Card>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** Items come from SHELTER.wishlist. There is no stock count or goal for them, so there is nothing to measure: no meters. */
function Wishlist() {
  return (
    <Section labelledBy="wishlist-heading">
      <SectionHeader id="wishlist-heading" title="Shelter wishlist" intro="Prefer to give supplies? These are the items we use most right now. Please bring clean, unopened items to the shelter during open hours." />
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {SHELTER.wishlist.map((item) => (
          <li key={item.name}>
            <Card as="div" className="flex h-full gap-4 p-5 sm:p-5">
              <IconTile><PawIcon width={24} height={24} /></IconTile>
              <div className="min-w-0">
                <p className="text-lg font-bold text-stone-950">{item.name}</p>
                <p className="mt-1 text-base leading-7 text-stone-800">{item.detail}</p>
              </div>
            </Card>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-base leading-7 text-stone-800">Not sure whether an item is a good fit? <TextLink href={`mailto:${SHELTER.email}?subject=Shelter%20wishlist`}>Ask us first</TextLink>.</p>
    </Section>
  );
}

function DonateContent() {
  const [amount, setAmount] = useState<number | null>(50);
  return (
    <>
      <PageHero
        id="donate-title"
        eyebrow="Donate"
        title="Help an animal get home."
        intro="Your gift helps us take care of the animals in our shelter until they find their families. Every amount helps, and every gift is appreciated."
        actions={<ButtonLink variant="primary" href="#gift">Choose a gift</ButtonLink>}
        className="[&>div]:pb-6 lg:[&>div]:pb-6"
      />

      <Section id="gift" tone="tint" labelledBy="gift-heading" className="scroll-mt-4">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start">
          <Card className="min-w-0 p-6 sm:p-8">
            <h2 id="gift-heading" className="text-2xl font-bold tracking-tight text-stone-950">Choose a gift</h2>
            {isTestDonateLink && (
              <Notice tone="warning" title="Test mode: no real money will move." className="mt-4">
                <span data-test-mode-notice>Use card number <span className="font-mono">4242 4242 4242 4242</span>, any future expiry date, any 3-digit security code, and any ZIP code.</span>
              </Notice>
            )}
            <fieldset className="mt-5 min-w-0">
              <legend className="text-sm font-semibold text-stone-950">Gift amount</legend>
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {PRESETS.map((preset) => (
                  <label key={preset} className={cx(pill, 'text-xl', pillState(amount === preset))}>
                    <input type="radio" name="gift" className="sr-only" checked={amount === preset} onChange={() => setAmount(preset)} />
                    {amount === preset && <CheckIcon aria-hidden="true" width={18} height={18} />}
                    ${preset}
                  </label>
                ))}
                <label className={cx(pill, 'col-span-2 text-base sm:col-span-4', pillState(amount === null))}>
                  <input type="radio" name="gift" className="sr-only" checked={amount === null} onChange={() => setAmount(null)} />
                  {amount === null && <CheckIcon aria-hidden="true" width={18} height={18} />}
                  Another amount
                </label>
              </div>
            </fieldset>
            <p role="status" className="mt-4 text-base leading-7 text-stone-800">
              {amount ? `You chose $${amount}. ` : 'You will type your amount on the next page. '}
              You will confirm the amount on Stripe&apos;s secure page before you pay. Every amount goes to food, vaccines, and medical care for the animals staying with us.
            </p>
            <a className={buttonClass('primary', 'mt-5 w-full whitespace-normal text-center text-lg sm:w-auto')} href={giftUrl(amount)} rel="noopener" data-donate-link>
              {amount ? `Give $${amount} securely with Stripe` : 'Donate securely with Stripe'}
            </a>

            <h3 className="mt-8 text-base font-bold text-stone-950">What happens next</h3>
            <ol className="mt-2 grid gap-1.5 pl-5 text-base leading-7 text-stone-800 [list-style:decimal]">
              <li>You go to Stripe&apos;s secure checkout page.</li>
              <li>You enter your gift, your contact details, and your payment details there.</li>
              <li>When the payment goes through you come back to PawHeaven, and Stripe emails your receipt.</li>
            </ol>
            <p className="mt-6 border-t border-stone-200 pt-4 text-sm leading-6 text-stone-700">
              Payments are processed by Stripe. PawHeaven never sees or stores your card details. If a payment is declined or you close the page, nothing is charged and you can try again.
            </p>
          </Card>

          <section aria-labelledby="uses-heading">
            <h2 id="uses-heading" className="text-2xl font-bold tracking-tight text-stone-950">What your gift does</h2>
            <p className="mt-2 text-base leading-7 text-stone-800">Gifts cover food, vaccines, and medical care for the animals staying with us. They help us look after each animal while they wait for a home.</p>
            <ul className="mt-5 grid gap-4">
              {USES.map((use) => (
                <li key={use.title}>
                  <Card as="div" className="flex gap-4 p-5 sm:p-5">
                    <IconTile><use.icon width={24} height={24} /></IconTile>
                    <div className="min-w-0">
                      <p className="text-lg font-bold text-stone-950">{use.title}</p>
                      <p className="mt-1 text-base leading-7 text-stone-800">{use.text}</p>
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </Section>

      <Wishlist />
      <SupporterWall />

      <Section labelledBy="other-heading">
        <div className="mx-auto max-w-3xl rounded-[var(--ph-radius)] border border-stone-300 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex items-start gap-4">
            <IconTile><UsersIcon width={24} height={24} /></IconTile>
            <div>
              <h2 id="other-heading" className="text-xl font-bold text-stone-950">Other ways to help</h2>
              <p className="mt-1 text-base leading-7 text-stone-800">Not able to give right now? You can still make a difference.</p>
            </div>
          </div>
          <ul className="mt-4 flex flex-wrap gap-3">
            <li><ButtonLink href="/adopt">Adopt an animal</ButtonLink></li>
            <li><ButtonLink href="/foster">Foster an animal</ButtonLink></li>
            <li><ButtonLink href="/volunteer">Volunteer your time</ButtonLink></li>
          </ul>
          <p className="mt-5 text-sm leading-6 text-stone-700">Questions about giving? Email <TextLink href={`mailto:${SHELTER.email}`}>{SHELTER.email}</TextLink> or call <TextLink href={SHELTER.phoneHref}>{SHELTER.phone}</TextLink>.</p>
        </div>
      </Section>
    </>
  );
}

export const DonatePage = () => <Providers><DonateContent /></Providers>;
