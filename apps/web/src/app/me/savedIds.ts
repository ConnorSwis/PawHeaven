import { useSaved } from '../adopt/saved';

/** Animals saved by this visitor: on the account when signed in, on this device otherwise. See `../adopt/saved.ts`. */
export function useSavedIds() {
  const { ids, remove, signedIn } = useSaved();
  return { ids, remove, signedIn };
}
