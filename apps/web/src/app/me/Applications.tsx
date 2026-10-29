import type { AdoptionApplicationListResponse, FosterApplicationListResponse, LostPetInquiryListResponse } from '@pawheaven/contracts';
import { useApi } from '../../lib/fetch';
import { ButtonLink } from '../../ui';
import { LoadState, Muted, Row, Section, StatusBadge, calendarDay, dayOnly } from './common';

export function Applications() {
  const adoption = useApi<AdoptionApplicationListResponse>('/applications');
  const foster = useApi<FosterApplicationListResponse>('/foster-applications');
  const inquiries = useApi<LostPetInquiryListResponse>('/lost-pet/inquiries');
  const byNewest = <T extends { submittedAt: string }>(items: T[]) => [...items].sort((a, b) => Date.parse(b.submittedAt) - Date.parse(a.submittedAt));

  return (
    <div className="grid gap-6">
      <Section id="adoption" title="Adoption applications" aside={<a className="inline-flex min-h-11 items-center font-medium text-[var(--ph-brand-strong)] underline underline-offset-4" href="/adopt">Find an animal</a>}>
        <LoadState query={adoption} label="your adoption applications">
          {adoption.data?.applications.length ? (
            <ul>{byNewest(adoption.data.applications).map((item) => (
              <Row key={item.id}>
                <div className="min-w-0 flex-1"><p className="font-semibold text-stone-950">{item.petName}</p><p className="mt-1 text-sm text-stone-700">Submitted {dayOnly(item.submittedAt)}{item.reviewedAt ? ` · Reviewed ${dayOnly(item.reviewedAt)}` : ''}</p></div>
                <StatusBadge status={item.status} />
              </Row>
            ))}</ul>
          ) : <div><Muted>No adoption applications yet. When you find an animal you love, choose Apply on their page.</Muted><div className="mt-3"><ButtonLink variant="secondary" href="/adopt">Meet the animals</ButtonLink></div></div>}
        </LoadState>
      </Section>

      <Section id="fostering" title="Foster applications" aside={<a className="inline-flex min-h-11 items-center font-medium text-[var(--ph-brand-strong)] underline underline-offset-4" href="/foster">About fostering</a>}>
        <LoadState query={foster} label="your foster applications">
          {foster.data?.applications.length ? (
            <ul>{byNewest(foster.data.applications).map((item) => (
              <Row key={item.id}>
                <div className="min-w-0 flex-1"><p className="font-semibold text-stone-950">{item.petName}</p><p className="mt-1 text-sm text-stone-700">Submitted {dayOnly(item.submittedAt)} · Available {calendarDay(item.availableFrom)} to {calendarDay(item.availableUntil)}</p></div>
                <StatusBadge status={item.status} />
              </Row>
            ))}</ul>
          ) : <div><Muted>No foster applications yet. Fostering gives an animal a break from the kennel.</Muted><div className="mt-3"><ButtonLink variant="secondary" href="/foster">Learn about fostering</ButtonLink></div></div>}
        </LoadState>
      </Section>

      <Section id="inquiries" title="Lost-pet inquiries" aside={<a className="inline-flex min-h-11 items-center font-medium text-[var(--ph-brand-strong)] underline underline-offset-4" href="/lost-pet">Lost a pet?</a>}>
        <LoadState query={inquiries} label="your lost-pet messages">
          {inquiries.data?.inquiries.length ? (
            <ul>{inquiries.data.inquiries.map((item) => (
              <Row key={item.id}>
                <div className="min-w-0 flex-1"><p className="font-semibold text-stone-950">Asked about {item.petName}</p><p className="mt-1 text-sm text-stone-700">Sent {dayOnly(item.createdAt)}</p><p className="mt-2 whitespace-pre-wrap text-base leading-7 text-stone-800">{item.message}</p></div>
                <StatusBadge status={item.status} />
              </Row>
            ))}</ul>
          ) : <Muted>You have not asked the shelter about a possible match. If you lost a pet, you can <a className="font-medium underline underline-offset-4" href="/lost-pet#check">check by photo</a>.</Muted>}
        </LoadState>
      </Section>
    </div>
  );
}
