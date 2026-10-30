import type { ShelterGroupStatus, ShelterLevel, ShelterStatus } from '@pawheaven/contracts';

const PRESSURE: Partial<Record<ShelterLevel, number>> = { busy: 1, full: 2, over: 3 };

/**
 * The one group worth telling visitors about: the most pressed, and the first listed when two are equal.
 * Null when every group is fine (`ok`) or has no kennel count yet (`unset`).
 */
export function pressedGroup(status: ShelterStatus | null | undefined): ShelterGroupStatus | null {
  let best: ShelterGroupStatus | null = null;
  const rank = (group: ShelterGroupStatus) => (PRESSURE[group.level] ?? 0) * 1000 + (group.percent ?? 0);
  for (const group of status?.groups ?? []) {
    if (!PRESSURE[group.level]) continue;
    if (!best || rank(group) > rank(best)) best = group;
  }
  return best;
}

type GroupWords = { kennels: string; foster: string; browse: string; species: 'dog' | 'cat' | 'other' };
const WORDS: Record<ShelterGroupStatus['group'], GroupWords> = {
  Dog: { kennels: 'dog kennels', foster: 'Foster a dog', browse: 'See dogs who can go home today', species: 'dog' },
  Cat: { kennels: 'cat kennels', foster: 'Foster a cat', browse: 'See cats who can go home today', species: 'cat' },
  Other: { kennels: 'kennels for other animals', foster: 'Foster an animal', browse: 'See animals who can go home today', species: 'other' },
};
export const groupWords = (group: ShelterGroupStatus['group']): GroupWords => WORDS[group] ?? WORDS.Other;

/** "28 dogs and 6 cats ready to meet", or null when nothing is ready. */
export function readyLine(status: ShelterStatus | null | undefined): string | null {
  const count = (group: ShelterGroupStatus['group']) => status?.groups.find((item) => item.group === group)?.ready ?? 0;
  const parts = [
    [count('Dog'), 'dog', 'dogs'],
    [count('Cat'), 'cat', 'cats'],
    [count('Other'), 'other animal', 'other animals'],
  ].flatMap(([n, one, many]) => (Number(n) > 0 ? [`${n} ${n === 1 ? one : many}`] : []));
  if (!parts.length) return null;
  const list = parts.length === 1 ? parts[0] : parts.length === 2 ? `${parts[0]} and ${parts[1]}` : `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
  return `${list} ready to meet`;
}
