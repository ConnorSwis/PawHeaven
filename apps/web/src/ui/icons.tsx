import type { SVGProps } from 'react';

const base = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, focusable: false } as const;
const icon = (paths: string[], filled = false) => (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...(filled ? { fill: 'currentColor' } : {})} {...props}>{paths.map((d) => <path key={d} d={d} />)}</svg>
);

export const SearchIcon = icon(['M11 18a7 7 0 100-14 7 7 0 000 14z', 'M20 20l-4-4']);
export const CloseIcon = icon(['M6 6l12 12', 'M18 6L6 18']);
export const CheckIcon = icon(['M5 12.5l4.5 4.5L19 7.5']);
export const HeartIcon = icon(['M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z']);
export const HeartFilledIcon = icon(['M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z'], true);
export const ChevronLeftIcon = icon(['M15 6l-6 6 6 6']);
export const ChevronRightIcon = icon(['M9 6l6 6-6 6']);
export const ChevronDownIcon = icon(['M6 9l6 6 6-6']);
export const CalendarIcon = icon(['M4 6h16v14H4z', 'M4 10h16', 'M8 3v4', 'M16 3v4']);
export const ClockIcon = icon(['M12 3a9 9 0 100 18 9 9 0 000-18z', 'M12 7v5l3 2']);
export const PinIcon = icon(['M12 21s7-6 7-11a7 7 0 10-14 0c0 5 7 11 7 11z', 'M12 12a2.2 2.2 0 100-4.4 2.2 2.2 0 000 4.4z']);
export const PawIcon = icon(['M12 13c-3 0-5 2-5 4 0 1.6 1.4 2.5 3 2.5 1 0 1.4-.4 2-.4s1 .4 2 .4c1.6 0 3-.9 3-2.5 0-2-2-4-5-4z', 'M6.5 10a1.6 1.9 0 100-.01', 'M17.5 10a1.6 1.9 0 100-.01', 'M9.5 6.5a1.5 2 0 100-.01', 'M14.5 6.5a1.5 2 0 100-.01']);
