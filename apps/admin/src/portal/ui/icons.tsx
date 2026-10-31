import type { SVGProps } from 'react';

const base = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;
const icon = (paths: string[]) => (props: SVGProps<SVGSVGElement>) => (
  <svg {...base} {...props}>{paths.map((d) => <path key={d} d={d} />)}</svg>
);

export const HomeIcon = icon(['M3 11l9-8 9 8', 'M5 10v10h14V10', 'M10 20v-6h4v6']);
export const PawIcon = icon(['M12 13c-3 0-5 2-5 4 0 1.6 1.4 2.5 3 2.5 1 0 1.4-.4 2-.4s1 .4 2 .4c1.6 0 3-.9 3-2.5 0-2-2-4-5-4z', 'M6.5 10a1.6 1.9 0 100-.01', 'M17.5 10a1.6 1.9 0 100-.01', 'M9.5 6.5a1.5 2 0 100-.01', 'M14.5 6.5a1.5 2 0 100-.01']);
export const InboxIcon = icon(['M4 13l2-8h12l2 8', 'M4 13v6h16v-6', 'M4 13h5l1 2h4l1-2h5']);
export const CalendarIcon = icon(['M4 6h16v14H4z', 'M4 10h16', 'M8 3v4', 'M16 3v4']);
export const HeartIcon = icon(['M12 20s-7-4.4-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.6-7 10-7 10z']);
export const CoinIcon = icon(['M12 3a9 9 0 100 18 9 9 0 000-18z', 'M14.5 9a2.5 2 0 00-2.5-1.5c-1.4 0-2.5.7-2.5 1.8s1.1 1.5 2.5 1.7 2.5.6 2.5 1.8-1.1 1.7-2.5 1.7A2.5 2 0 019.5 14.5', 'M12 6v1.5', 'M12 16.5V18']);
export const UsersIcon = icon(['M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7z', 'M2.5 20c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5', 'M16 4.5a3.5 3.5 0 010 6.5', 'M18 14.8c2.2.6 3.5 2.3 3.5 5.2']);
export const SearchIcon = icon(['M11 18a7 7 0 100-14 7 7 0 000 14z', 'M20 20l-4-4']);
export const MenuIcon = icon(['M4 6h16', 'M4 12h16', 'M4 18h16']);
export const CloseIcon = icon(['M6 6l12 12', 'M18 6L6 18']);
export const PlusIcon = icon(['M12 5v14', 'M5 12h14']);
export const ChevronLeftIcon = icon(['M15 6l-6 6 6 6']);
export const ChevronRightIcon = icon(['M9 6l6 6-6 6']);
export const SortIcon = icon(['M8 9l4-4 4 4', 'M8 15l4 4 4-4']);
export const ExternalIcon = icon(['M14 4h6v6', 'M20 4l-9 9', 'M18 14v5H5V6h5']);
export const SettingsIcon = icon(['M12 15a3 3 0 100-6 3 3 0 000 6z', 'M19 12a7 7 0 00-.1-1.2l2-1.5-2-3.4-2.3.9a7 7 0 00-2-1.2L14.2 3h-4l-.4 2.6a7 7 0 00-2 1.2l-2.3-.9-2 3.4 2 1.5A7 7 0 005 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.3-.9a7 7 0 002 1.2l.4 2.6h4l.4-2.6a7 7 0 002-1.2l2.3.9 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z']);
export const MailIcon = icon(['M3 6h18v12H3z', 'M3.5 7l8.5 6.5L20.5 7']);
