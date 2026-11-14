import { useEffect, useState } from 'react';

/** Resolves any theme variable (a color, or a size) to the computed value canvas code needs, because a canvas cannot read `var(...)`. */
export function resolveVar(name: string, property: 'color' | 'borderTopLeftRadius' | 'fontFamily' = 'color'): string {
  const probe = document.createElement('span');
  probe.style.display = 'none';
  if (property === 'color') probe.style.color = `var(${name})`;
  else if (property === 'borderTopLeftRadius') probe.style.borderTopLeftRadius = `var(${name})`;
  else probe.style.fontFamily = `var(${name})`;
  document.body.appendChild(probe);
  const value = getComputedStyle(probe)[property];
  probe.remove();
  return value;
}

/** Changes whenever the portal switches theme (or a live theme variable changes), so canvas charts can redraw in the new colors. */
export function useThemeVersion() {
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const observer = new MutationObserver(() => setVersion((current) => current + 1));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style', 'class'] });
    return () => observer.disconnect();
  }, []);
  return version;
}
