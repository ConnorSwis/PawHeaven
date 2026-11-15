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
    return <div role="img" aria-label={`No photo of ${pet.name} yet`} className="flex aspect-[4/3] w-full items-center justify-center gap-2 rounded-[calc(var(--ph-radius)-0.5rem)] bg-stone-200 text-stone-700"><PawIcon width={28} height={28} /><span className="text-sm font-medium">Photo coming soon</span></div>;
  }
  return <img src={pet.imageUrl} alt={`${pet.name}, ${pet.breed || pet.type}`} loading="lazy" onError={() => setFailed(true)} className="aspect-[4/3] w-full rounded-[calc(var(--ph-radius)-0.5rem)] bg-stone-200 object-cover" />;
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
    <Section id="saved" title="Saved animals">
      {!signedIn && <Muted className="mb-4 text-sm">Kept on this device only.</Muted>}
      <p role="status" className="mb-3 text-sm text-stone-800">{message}</p>
      {!ids.length ? (
        <EmptyState pose="sleeping" title="You have not saved any animals yet" action={<ButtonLink variant="primary" href="/adopt" className="mt-2">Meet the animals</ButtonLink>}>
          Tap the heart on an animal to keep them here.
        </EmptyState>
      ) : (
        <LoadState query={pets} label="your saved animals" skeleton="h-48">
          {pets.isPending ? <Skeleton className="h-48" /> : (
            <>
              {shown.length > 0 && (
                <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {shown.map((pet) => (
                    <li key={pet.id} className="ph-lift flex flex-col rounded-[var(--ph-radius)] border border-stone-300 bg-white p-3 shadow-sm">
                      <SavedPhoto pet={pet} />
                      <div className="flex flex-1 flex-col px-2 pb-2 pt-4">
                        <h3 className="text-lg font-bold text-stone-950"><a className="underline-offset-4 hover:underline" href={petPath(pet)}>{pet.name}</a></h3>
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
                <div className="mt-5 rounded-[var(--ph-radius-sm)] border border-stone-300 bg-stone-50 p-4">
                  <p className="text-base text-stone-800">{gone.length === 1 ? '1 saved animal is' : `${gone.length} saved animals are`} no longer listed. They may have found a home.</p>
                  <div className="mt-2"><Button variant="secondary" onClick={() => { remove(gone); setMessage('Animals that are no longer listed were removed.'); }}>Remove {gone.length === 1 ? 'it' : 'them'} from my list</Button></div>
                </div>
              )}
                          </>
          )}
        </LoadState>
      )}
    </Section>
  );
}
