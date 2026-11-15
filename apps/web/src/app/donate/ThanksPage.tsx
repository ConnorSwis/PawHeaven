import { SHELTER } from '@pawheaven/contracts/site';
import { ButtonLink, Card, IconTile, PageHero, Section, SectionHeader, TextLink } from '../../ui';
import { HeartIcon, HomeIcon, PawIcon } from '../../ui/icons';
import { Mascot } from '../../ui/Mascot';
import { Providers } from '../../lib/providers';

const NEXT = [
  { title: 'Meet an animal', text: 'See who is waiting for a home right now.', href: '/adopt', action: 'Adopt', icon: PawIcon },
  { title: 'Open your home for a while', text: 'Fostering gives an animal a break from the kennel and helps them get ready for a family.', href: '/foster', action: 'Foster', icon: HomeIcon },
  { title: 'Give some time', text: 'Walk dogs, socialize cats, and help out at the shelter.', href: '/volunteer', action: 'Volunteer', icon: HeartIcon },
] as const;

function ThanksContent() {
  return (
    <>
      <PageHero
        id="thanks-title"
        eyebrow="Gift received"
        title="Thank you for your gift."
        intro="Your support helps us feed, treat, and care for the animals in our shelter while they wait for their families. We are grateful."
        aside={<div className="mx-auto grid w-[min(80%,15rem)] place-items-center rounded-full bg-[var(--ph-brand-soft)] p-4 lg:w-full lg:max-w-xs"><Mascot pose="celebrating" species="dog" size={220} className="ph-enter h-auto w-full" /></div>}
        asideFirst
      >
        <p className="mt-5 max-w-xl text-base leading-7 text-stone-800">Stripe emails your receipt to the address you entered at checkout. If it does not arrive within a few minutes, check your spam folder or email <TextLink href={`mailto:${SHELTER.email}`}>{SHELTER.email}</TextLink>.</p>
      </PageHero>

      <Section tone="tint" labelledBy="next-heading">
        <SectionHeader id="next-heading" title="Want to do more?" />
        <ul className="mt-8 grid gap-5 sm:grid-cols-3">
          {NEXT.map((item) => (
            <li key={item.href}>
              <Card as="div" className="flex h-full flex-col gap-2">
                <IconTile><item.icon width={24} height={24} /></IconTile>
                <h3 className="mt-1 text-lg font-semibold text-stone-950">{item.title}</h3>
                <p className="flex-1 text-base leading-7 text-stone-800">{item.text}</p>
                <ButtonLink href={item.href} variant="secondary" className="mt-3 self-start">{item.action}</ButtonLink>
              </Card>
            </li>
          ))}
        </ul>
      </Section>

      <Section labelledBy="payment-note-heading" innerClassName="py-10 sm:py-12">
        <h2 id="payment-note-heading" className="sr-only">If you did not finish a payment</h2>
        <p className="mx-auto max-w-3xl text-center text-sm leading-6 text-stone-700">
          Did you land here without finishing a payment? Nothing was charged. <TextLink href="/donate">Go back to the donation page</TextLink> to try again. <TextLink href="/">Back to home</TextLink>
        </p>
      </Section>
    </>
  );
}

export const ThanksPage = () => <Providers><ThanksContent /></Providers>;
