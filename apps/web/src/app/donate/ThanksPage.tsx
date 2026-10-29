import { SHELTER } from '@pawheaven/contracts/site';
import { ButtonLink, Card, PageHeading, TextLink } from '../../ui';
import { Providers } from '../../lib/providers';

const NEXT = [
  { title: 'Meet an animal', text: 'See who is waiting for a home right now.', href: '/adopt', action: 'Adopt' },
  { title: 'Open your home for a while', text: 'Fostering gives an animal a break from the kennel and helps them get ready for a family.', href: '/foster', action: 'Foster' },
  { title: 'Give some time', text: 'Walk dogs, socialize cats, and help out at the shelter.', href: '/volunteer', action: 'Volunteer' },
] as const;

function ThanksContent() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <PageHeading title="Thank you for your gift" intro="Your support helps us feed, treat, and care for the animals in our shelter while they wait for their families. We are grateful." />
      <p className="mt-4 max-w-3xl text-base leading-7 text-stone-800">Stripe emails your receipt to the address you entered at checkout. If it does not arrive within a few minutes, check your spam folder or email <a className="font-medium underline underline-offset-4" href={`mailto:${SHELTER.email}`}>{SHELTER.email}</a>.</p>

      <section aria-labelledby="next-heading" className="mt-10">
        <h2 id="next-heading" className="text-xl font-semibold text-stone-950">Want to do more?</h2>
        <ul className="mt-4 grid gap-4 sm:grid-cols-3">
          {NEXT.map((item) => (
            <li key={item.href}>
              <Card as="div" className="flex h-full flex-col">
                <h3 className="text-lg font-semibold text-stone-950">{item.title}</h3>
                <p className="mt-1.5 flex-1 text-base leading-7 text-stone-800">{item.text}</p>
                <ButtonLink href={item.href} variant="secondary" className="mt-4 self-start">{item.action}</ButtonLink>
              </Card>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-10 border-t border-stone-300 pt-5 text-sm leading-6 text-stone-700">
        Did you land here without finishing a payment? Nothing was charged. <TextLink href="/donate">Go back to the donation page</TextLink> to try again. <TextLink href="/">Back to home</TextLink>
      </p>
    </div>
  );
}

export const ThanksPage = () => <Providers><ThanksContent /></Providers>;
