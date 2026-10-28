import type { MemberProfile, MemberProfileInput, MemberProfileResponse } from '@pawheaven/contracts';
import { apiRequest, el } from '@pawheaven/contracts/ui';
import { apiBase } from './api';

/** The signed-in member's saved contact details, or null when signed out or unavailable. A form must work without it. */
export async function loadProfile(): Promise<MemberProfile | null> {
  try { return (await apiRequest<MemberProfileResponse>(apiBase, '/profile')).profile; } catch { return null; }
}

/**
 * Best effort: saving a profile must never make a submitted form look failed.
 * Values merge into what is already saved, so the volunteer form (which has no
 * address) cannot erase a saved address.
 */
export async function saveProfile(values: Partial<MemberProfileInput>): Promise<void> {
  try {
    const existing = await loadProfile();
    const merged: MemberProfileInput = {
      phone: values.phone || existing?.phone || '',
      address: values.address || existing?.address || '',
      dateOfBirth: values.dateOfBirth || existing?.dateOfBirth || '',
    };
    await apiRequest(apiBase, '/profile', { method: 'PUT', json: merged });
  } catch { /* The form already succeeded. */ }
}

type Field = { value: string };

/** Fills empty phone, address, and date-of-birth controls from the saved profile; anything already typed or restored from a draft wins. */
export async function prefillContact(controls: Map<string, Field>, names: Partial<Record<keyof MemberProfile, string>>): Promise<boolean> {
  const profile = await loadProfile();
  if (!profile) return false;
  let filled = false;
  for (const [key, name] of Object.entries(names) as [keyof MemberProfile, string][]) {
    const control = name ? controls.get(name) : undefined;
    const saved = profile[key];
    if (control && !control.value && saved) { control.value = saved; filled = true; }
  }
  return filled;
}

/** The "save these details" checkbox shown under a form's contact fields. */
export function saveDetailsBox(): { wrapper: HTMLElement; input: HTMLInputElement } {
  const wrapper = el('label', 'flex items-start gap-3 text-sm text-stone-800');
  const input = Object.assign(el('input', 'mt-1 size-4'), { type: 'checkbox', checked: true });
  wrapper.append(input, el('span', '', 'Save my phone, address, and date of birth to My PawHeaven so I do not have to type them again. You can change them any time.'));
  return { wrapper, input };
}
