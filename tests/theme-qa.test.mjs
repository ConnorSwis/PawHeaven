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

const siteSource = readFileSync('packages/contracts/src/site.ts', 'utf8');
const listedThemes = [...siteSource.matchAll(/\{\s*id:\s*'([a-z-]*)'/g)].map((match) => match[1]);
const cssThemes = [...theme.matchAll(/\[data-theme="([a-z-]+)"\]\s*\{/g)].map((match) => match[1]);

test('theme: the switcher list and the [data-theme] blocks name the same themes', () => {
  assert.equal(listedThemes[0], '', 'the first listed theme is the default (empty id)');
  assert.deepEqual([...listedThemes.slice(1)].sort(), [...cssThemes].sort());
  assert.ok(cssThemes.length >= 5, 'several showcase themes ship');
});

// WCAG contrast between two #rrggbb colors.
const luminance = (hex) => {
  const channels = [1, 3, 5].map((index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255)
    .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};
const contrast = (first, second) => {
  const [lighter, darker] = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (lighter + 0.05) / (darker + 0.05);
};
const values = (css) => Object.fromEntries([...css.matchAll(/(--ph-[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)].map((match) => [match[1], match[2]]));
const themeValues = (name) => {
  if (!name) return values(block(':root'));
  const body = theme.match(new RegExp(`\\[data-theme="${name}"\\]\\s*\\{([\\s\\S]*?)\\n\\}`))[1];
  return { ...values(block(':root')), ...values(body) };
};

// Each pair is (text, background, minimum ratio, what it is). AA is 4.5 for text; faint text is decorative-adjacent, so 3.
const pairs = [
  ['--ph-ink', '--ph-page', 4.5, 'body text on the page'],
  ['--ph-ink', '--ph-surface', 4.5, 'body text on cards'],
  ['--ph-ink-strong', '--ph-surface', 4.5, 'headings on cards'],
  ['--ph-ink-soft', '--ph-surface', 4.5, 'secondary text on cards'],
  ['--ph-ink-muted', '--ph-surface', 4.5, 'muted text on cards'],
  ['--ph-ink-muted', '--ph-page', 4.5, 'muted text on the page'],
  ['--ph-ink-faint', '--ph-surface', 3, 'faint text on cards'],
  ['--ph-on-brand', '--ph-brand', 4.5, 'button text on the brand color'],
  ['--ph-brand-strong', '--ph-surface', 4.5, 'links on cards'],
  ['--ph-brand-strong', '--ph-brand-soft', 4.5, 'text on the brand tint'],
  ['--ph-danger', '--ph-surface', 4.5, 'error text on cards'],
  ['--ph-danger-strong', '--ph-danger-soft', 4.5, 'text in error boxes'],
  ['--ph-warning-strong', '--ph-warning-soft', 4.5, 'text in warning boxes'],
  ['--ph-success-strong', '--ph-success-soft', 4.5, 'text in confirmation boxes'],
  ['--ph-border-strong', '--ph-surface', 3, 'form field borders against cards'],
];

for (const id of listedThemes) {
  test(`theme: "${id || 'default'}" keeps text readable (WCAG AA)`, () => {
    const colors = themeValues(id);
    const failures = [];
    for (const [text, background, minimum, label] of pairs) {
      assert.ok(colors[text] && colors[background], `${text} and ${background} resolve to hex colors`);
      const ratio = contrast(colors[text], colors[background]);
      if (ratio < minimum) failures.push(`${label}: ${ratio.toFixed(2)}:1 (needs ${minimum}:1) ${text} ${colors[text]} on ${background} ${colors[background]}`);
    }
    assert.deepEqual(failures, [], failures.join('\n'));
  });
}
