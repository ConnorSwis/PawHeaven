import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const themePath = 'packages/contracts/src/theme.css';
const theme = readFileSync(themePath, 'utf8');

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(astro|ts|css)$/.test(name) && path !== themePath ? [path] : [];
  });
}
const files = ['apps/web/src', 'apps/admin/src', 'packages/contracts/src'].flatMap(sourceFiles);
// Two files legitimately handle raw colors: a printed flyer is deliberately dark on white whatever the theme is,
// and the theme playground converts picker values, which are always hex strings.
const PINNED = new Set(['apps/web/src/components/LostPetFlyer.astro', 'apps/web/src/pages/theme.astro']);

const block = (name) => {
  const match = theme.match(new RegExp(`${name}\\s*\\{([\\s\\S]*?)\\n\\}`));
  assert.ok(match, `${name} block exists in theme.css`);
  return match[1];
};
const declared = (css) => new Set([...css.matchAll(/(--ph-[a-z0-9-]+)\s*:/g)].map((match) => match[1]));
const rootVars = declared(block(':root'));

test('theme: no component hardcodes a color, so the theme file controls everything', () => {
  const offenders = [];
  for (const file of files) {
    if (PINNED.has(file)) continue;
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/#[0-9a-fA-F]{3,8}\b|\b(?:rgb|rgba|hsl|hsla|oklch)\(/g)) {
      const line = text.slice(0, match.index).split('\n').length;
      offenders.push(`${file}:${line} ${match[0]}`);
    }
  }
  assert.deepEqual(offenders, [], `Hardcoded colors found. Use a --ph-* variable or a themed class:\n${offenders.join('\n')}`);
});

test('theme: only color utilities that the theme file maps are used', () => {
  const mapped = new Set([...theme.matchAll(/--color-([a-z]+-\d+)\s*:/g)].map((match) => match[1]));
  for (let shade = 50; shade <= 950; shade += shade < 100 ? 50 : 100) mapped.add(`stone-${shade}`);
  const unthemedFamilies = /\b(?:bg|text|border|ring|fill|stroke|decoration|outline|accent|caret|divide|from|to|via|placeholder:text|file:bg|file:text|hover:bg|hover:text|hover:border)-(?:slate|gray|zinc|neutral|orange|yellow|lime|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black)(?:-\d+)?\b/g;
  const offenders = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(unthemedFamilies)) offenders.push(`${file}: ${match[0]}`);
    for (const match of text.matchAll(/\b(?:bg|text|border|ring|fill|stroke|decoration|outline|placeholder:text|file:bg|file:text)-(red|amber|green|stone)-(\d+)/g)) {
      if (!mapped.has(`${match[1]}-${match[2]}`)) offenders.push(`${file}: ${match[0]} is not mapped in theme.css`);
    }
  }
  assert.deepEqual([...new Set(offenders)], [], `Unthemed colors found:\n${[...new Set(offenders)].join('\n')}`);
});

test('theme: every --ph-* variable used anywhere is defined in the theme file', () => {
  const missing = [];
  for (const file of [...files, themePath]) {
    const text = readFileSync(file, 'utf8');
    for (const match of text.matchAll(/var\((--ph-[a-z0-9-]+)/g)) if (!rootVars.has(match[1])) missing.push(`${file}: ${match[1]}`);
  }
  assert.deepEqual([...new Set(missing)], [], `Undefined theme variables:\n${[...new Set(missing)].join('\n')}`);
});

test('theme: an alternate theme only overrides variables that exist', () => {
  for (const [, name, body] of theme.matchAll(/\[data-theme="([a-z-]+)"\]\s*\{([\s\S]*?)\n\}/g)) {
    const unknown = [...declared(body)].filter((variable) => !rootVars.has(variable));
    assert.deepEqual(unknown, [], `[data-theme="${name}"] overrides unknown variables`);
  }
});

test('theme: Tailwind is wired to the theme variables for color, font, spacing, and widths', () => {
  const wiring = theme.match(/@theme\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
  for (const required of ['--font-sans', '--spacing', '--container-6xl', '--color-white', '--color-moss', '--color-stone-300', '--color-red-800']) {
    assert.ok(wiring.includes(`${required}:`), `${required} is mapped in @theme`);
  }
  for (const app of ['web', 'admin']) {
    assert.ok(readFileSync(`apps/${app}/src/styles/global.css`, 'utf8').includes('theme.css'), `${app} imports the theme file`);
  }
});
