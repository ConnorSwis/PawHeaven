import type { AdoptionApplication, FosterApplication } from '@pawheaven/contracts';
import { formatDate } from '../../lib/format';
import { Detail, Sheet, StatusBadge } from '../../ui';
import { OutcomeForm } from './OutcomeForm';

const paragraph = (text: string) => <p className="whitespace-pre-wrap text-sm leading-6 text-stone-800">{text}</p>;

export function AdoptionSheet({ application, onClose }: { application: AdoptionApplication; onClose: () => void }) {
  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }} title={`${application.applicantName} · ${application.petName}`} description={`Adoption application submitted ${formatDate(application.submittedAt)}`}>
      <div className="grid gap-5">
        <dl className="grid grid-cols-2 gap-4">
          <Detail label="Status"><StatusBadge status={application.status} /></Detail>
          <Detail label="Animal">{application.petName}</Detail>
          <Detail label="Email">{application.applicantEmail}</Detail>
          <Detail label="Phone">{application.applicantPhone}</Detail>
          <Detail label="Address">{application.applicantAddress}</Detail>
          <Detail label="Date of birth">{application.applicantDateOfBirth}</Detail>
        </dl>
        <section><h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-600">Household</h3>{paragraph(application.householdSummary)}</section>
        <section><h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-600">Pet-care experience</h3>{paragraph(application.adoptionExperience)}</section>
        {application.note && <section><h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-600">Note from the applicant</h3>{paragraph(application.note)}</section>}
        {application.reviewedAt && <p className="text-xs text-stone-600">Last reviewed {formatDate(application.reviewedAt)}.</p>}
        <OutcomeForm key={application.id + application.status} endpoint={`/admin/applications/${application.id}`} status={application.status} petName={application.petName} markStatus="Pending" markLabel={`Also mark ${application.petName} Pending`} onSaved={() => undefined} />
      </div>
    </Sheet>
  );
}

export function FosterSheet({ application, onClose }: { application: FosterApplication; onClose: () => void }) {
  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }} title={`${application.applicantName} · ${application.petName}`} description={`Foster application submitted ${formatDate(application.submittedAt)}`}>
      <div className="grid gap-5">
        <dl className="grid grid-cols-2 gap-4">
          <Detail label="Status"><StatusBadge status={application.status} /></Detail>
          <Detail label="Animal">{application.petName}</Detail>
          <Detail label="Can foster from">{formatDate(`${application.availableFrom}T12:00:00Z`)}</Detail>
          <Detail label="Until">{formatDate(`${application.availableUntil}T12:00:00Z`)}</Detail>
          <Detail label="Email">{application.applicantEmail}</Detail>
          <Detail label="Phone">{application.applicantPhone}</Detail>
          <Detail label="Address">{application.applicantAddress}</Detail>
          <Detail label="Date of birth">{application.applicantDateOfBirth}</Detail>
        </dl>
        <section><h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-600">Household</h3>{paragraph(application.householdSummary)}</section>
        <section><h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-600">Foster experience</h3>{paragraph(application.fosterExperience)}</section>
        {application.note && <section><h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-stone-600">Note from the applicant</h3>{paragraph(application.note)}</section>}
        <OutcomeForm key={application.id + application.status} endpoint={`/admin/foster-applications/${application.id}`} status={application.status} petName={application.petName} markStatus="Fostered" markLabel={`Also mark ${application.petName} Fostered`} onSaved={() => undefined} />
      </div>
    </Sheet>
  );
}
