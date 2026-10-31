import { useState } from 'react';
import type { Pet } from '@pawheaven/contracts';
import { useApi } from '../../lib/fetch';
import { Button, ButtonLink, EmptyState, Skeleton } from '../../ui';
import { PawIcon } from '../../ui/icons';
import { LoadState, Muted, Section, petPath } from './common';
import { useSavedIds } from './savedIds';

function SavedPhoto({ pet }: { pet: Pet }) {
  const [failed, setFailed] = useState(false);
  if (!pet.imageUrl || failed) {
    return <div role="img" aria-label={`No photo of ${pet.name} yet`} className="flex aspect-[4/3] w-full items-center justify-center gap-2 bg-stone-200 text-stone-700"><PawIcon width={28} height={28} /><span className="text-sm font-medium">Photo coming soon</span></div>;
  }
  return <img src={pet.imageUrl} alt={`${pet.name}, ${pet.breed || pet.type}`} loading="lazy" onError={() => setFailed(true)} className="aspect-[4/3] w-full bg-stone-200 object-cover" />;
}

/** Animals saved on this device. Works for guests too, because nothing here needs an account. */
export function Saved() {
  const { ids, remove, signedIn } = useSavedIds();
  const pets = useApi<{ pets: Pet[] }>(ids.length ? '/pets' : null, { staleSeconds: 60 });
  const [message, setMessage] = useState('');
  const byId = new Map((pets.data?.pets ?? []).map((pet) => [pet.id, pet]));
  const shown = ids.flatMap((id) => (byId.has(id) ? [byId.get(id) as Pet] : []));
  const gone = pets.data ? ids.filter((id) => !byId.has(id)) : [];

  function unsave(pet: Pet) { remove([pet.id]); setMessage(`${pet.name} was removed from your saved animals.`); }

  return (
    <Section id="saved" title="Saved animals" aside={ids.length ? <a className="inline-flex min-h-11 items-center font-medium text-[var(--ph-brand-strong)] underline underline-offset-4" href="/adopt">Find more animals</a> : undefined}>
      <Muted className="mb-4 text-sm">{signedIn ? 'Saved to your account, so they show on every device.' : 'Saved animals are kept on this device only. They are not tied to an account.'}</Muted>
      <p role="status" className="mb-3 text-sm text-stone-800">{message}</p>
      {!ids.length ? (
        <EmptyState title="You have not saved any animals yet" action={<ButtonLink variant="primary" href="/adopt" className="mt-2">Meet the animals</ButtonLink>}>
          On the Adopt page, choose the heart on an animal to save them here and come back to them later.
        </EmptyState>
      ) : (
        <LoadState query={pets} label="your saved animals" skeleton="h-48">
          {pets.isPending ? <Skeleton className="h-48" /> : (
            <>
              {shown.length > 0 && (
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {shown.map((pet) => (
                    <li key={pet.id} className="flex flex-col overflow-hidden rounded-[var(--ph-radius)] border border-stone-300 bg-white">
                      <SavedPhoto pet={pet} />
                      <div className="flex flex-1 flex-col p-4">
                        <h3 className="text-lg font-semibold text-stone-950"><a className="underline-offset-4 hover:underline" href={petPath(pet)}>{pet.name}</a></h3>
                        <p className="mt-1 text-sm text-stone-700">{[pet.breed || pet.type, pet.age, pet.sex].filter(Boolean).join(' · ')}</p>
                        <div className="mt-auto flex flex-wrap gap-2 pt-4">
                          <ButtonLink variant="primary" href={petPath(pet)}>View<span className="sr-only"> {pet.name}</span></ButtonLink>
                          <Button variant="secondary" onClick={() => unsave(pet)}>Unsave<span className="sr-only"> {pet.name}</span></Button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {gone.length > 0 && (
                <div className="mt-5 rounded-[var(--ph-radius)] border border-stone-300 bg-stone-50 p-4">
                  <p className="text-base text-stone-800">{gone.length === 1 ? '1 animal you saved is' : `${gone.length} animals you saved are`} no longer listed. They may have found a home.</p>
                  <div className="mt-2"><Button variant="secondary" onClick={() => { remove(gone); setMessage('Animals that are no longer listed were removed.'); }}>Remove {gone.length === 1 ? 'it' : 'them'} from my list</Button></div>
                </div>
              )}
              {!shown.length && !gone.length && <Muted>Nothing to show.</Muted>}
            </>
          )}
        </LoadState>
      )}
    </Section>
  );
}
