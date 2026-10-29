import { useState } from 'react';
import type { AdoptionApplicationStatus, PetStatusUpdate } from '@pawheaven/contracts';
import { api, errorMessage, useRefresh } from '../../lib/api';
import { Button, Field, Select } from '../../ui';
import { useToast } from '../../ui/toast';

/** Outcome picker shared by adoption and foster review. "Also mark the pet" is offered only when approving. */
export function OutcomeForm({ endpoint, status, petName, markLabel, markStatus, onSaved }: {
  endpoint: string; status: AdoptionApplicationStatus; petName: string; markLabel: string; markStatus: 'Pending' | 'Fostered'; onSaved: () => void;
}) {
  const [choice, setChoice] = useState<string>(status === 'Pending' ? '' : status);
  const [markPet, setMarkPet] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const refresh = useRefresh();
  const changed = choice !== '' && (choice !== status || (choice === 'Approved' && markPet));

  const save = async () => {
    setBusy(true);
    try {
      const result = await api<{ petStatusUpdate?: PetStatusUpdate }>(endpoint, { method: 'PUT', json: { status: choice, ...(choice === 'Approved' && markPet && { markPetStatus: markStatus }) } });
      if (result.petStatusUpdate === 'applied') toast.success(`Saved. ${petName} is now marked ${markStatus}.`);
      else if (result.petStatusUpdate === 'failed') toast.error('The outcome was saved, but the animal’s status could not be changed. Change it on the Animals page.');
      else toast.success('Outcome saved. The applicant is emailed when it changes.');
      await refresh('/admin/applications', '/admin/foster-applications', '/admin/pets');
      onSaved();
    } catch (error) { toast.error(errorMessage(error)); } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-3 border-t border-stone-200 pt-5">
      <h3 className="text-sm font-semibold text-stone-950">Outcome</h3>
      <Field label="Decision">
        <Select value={choice} onChange={(event) => setChoice(event.target.value)}>
          {status === 'Pending' && <option value="">Choose an outcome…</option>}
          <option value="In review">In review</option>
          <option value="Approved">Approved</option>
          <option value="Declined">Declined</option>
        </Select>
      </Field>
      {choice === 'Approved' && (
        <label className="flex items-start gap-2 text-sm text-stone-800">
          <input type="checkbox" className="mt-1" checked={markPet} onChange={(event) => setMarkPet(event.target.checked)} />
          <span>{markLabel}<span className="block text-xs text-stone-600">Approving alone never changes {petName}’s listing.</span></span>
        </label>
      )}
      <Button variant="primary" className="justify-self-start" disabled={busy || !changed} onClick={() => void save()}>{busy ? 'Saving…' : 'Save outcome'}</Button>
    </div>
  );
}
