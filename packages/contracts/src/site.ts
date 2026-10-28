/**
 * Site identity shown in the header, page titles, and footer. Change a value
 * and both the public site and the staff portal follow after a rebuild.
 * Colors, fonts, and sizes live in theme.css.
 */
export const SITE = {
  name: 'PawHeaven',
  adminName: 'PawHeaven Admin',
  tagline: 'Helping shelter pets find their next home.',
} as const;

/**
 * The themes defined in theme.css, in the order the playground and the optional
 * theme switcher list them. An empty id is the default theme. A test keeps this
 * list and the [data-theme] blocks in sync.
 */
export const THEMES = [
  { id: '', label: 'Moss (default)' },
  { id: 'ocean', label: 'Ocean' },
  { id: 'sunset', label: 'Sunset' },
  { id: 'lavender', label: 'Lavender' },
  { id: 'dark', label: 'Dark' },
  { id: 'midnight', label: 'Midnight' },
  { id: 'contrast', label: 'High contrast' },
] as const;
