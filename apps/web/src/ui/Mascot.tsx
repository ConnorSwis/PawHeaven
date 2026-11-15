import type { ReactNode } from 'react';

/**
 * The PawHeaven mascots: a dog (Pip) and a cat (Mochi), drawn with theme variables so every theme
 * recolors them. Poses say what is happening: welcome (waving), searching, sleeping, celebrating.
 * Use them for empty, success, and not-found states only (see docs/design-guide.md). They are
 * decorative by default; pass `title` when the drawing carries meaning on its own.
 */
export type MascotPose = 'welcome' | 'searching' | 'sleeping' | 'celebrating';
export type MascotSpecies = 'dog' | 'cat';

const INK = 'var(--ph-ink-strong)';
const FUR = 'var(--ph-pop)';
const FUR_DARK = 'color-mix(in oklab, var(--ph-pop) 62%, var(--ph-ink))';
const LIGHT = 'var(--ph-surface)';
const CHEEK = 'color-mix(in oklab, var(--ph-accent) 40%, transparent)';
const TONGUE = 'color-mix(in oklab, var(--ph-danger) 70%, var(--ph-surface))';
const SPARK = 'var(--ph-accent)';
const BRAND = 'var(--ph-brand)';

function Eyes({ pose }: { pose: MascotPose }) {
  if (pose === 'sleeping') {
    return <g fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round"><path d="M70 106q8 8 16 0" /><path d="M114 106q8 8 16 0" /></g>;
  }
  if (pose === 'celebrating') {
    return <g fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round"><path d="M70 110q8-12 16 0" /><path d="M114 110q8-12 16 0" /></g>;
  }
  const look = pose === 'searching' ? 3 : 0;
  return (
    <g>
      <circle cx="78" cy="104" r="7" fill={INK} /><circle cx="122" cy="104" r="7" fill={INK} />
      <circle cx={80 + look} cy="101.500" r="2.400" fill={LIGHT} /><circle cx={124 + look} cy="101.500" r="2.400" fill={LIGHT} />
    </g>
  );
}

function Mouth({ pose, species }: { pose: MascotPose; species: MascotSpecies }) {
  if (pose === 'celebrating') {
    return (
      <g>
        <path d="M86 134q14 20 28 0z" fill={INK} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
        <path d="M94 140q6 8 12 0z" fill={TONGUE} />
      </g>
    );
  }
  if (pose === 'sleeping') return <path d="M92 136q8 5 16 0" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />;
  return species === 'cat'
    ? <path d="M86 134q7 8 14 0q7 8 14 0" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    : <path d="M100 128v6M86 134q14 12 28 0" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />;
}

function Dog({ pose }: { pose: MascotPose }) {
  return (
    <g>
      <ellipse cx="100" cy="192" rx="58" ry="34" fill={FUR} />
      <ellipse cx="46" cy="96" rx="19" ry="34" fill={FUR_DARK} transform="rotate(14 46 96)" />
      <ellipse cx="154" cy="96" rx="19" ry="34" fill={FUR_DARK} transform="rotate(-14 154 96)" />
      <ellipse cx="100" cy="108" rx="58" ry="52" fill={FUR} />
      <ellipse cx="100" cy="134" rx="32" ry="24" fill={LIGHT} />
      <circle cx="64" cy="124" r="9" fill={CHEEK} /><circle cx="136" cy="124" r="9" fill={CHEEK} />
      <Eyes pose={pose} />
      <ellipse cx="100" cy="121" rx="10" ry="7" fill={INK} /><ellipse cx="97" cy="119" rx="3" ry="1.800" fill={LIGHT} opacity=".7" />
      <Mouth pose={pose} species="dog" />
    </g>
  );
}

function Cat({ pose }: { pose: MascotPose }) {
  return (
    <g>
      <ellipse cx="100" cy="192" rx="56" ry="34" fill={FUR} />
      <path d="M48 76 56 22 98 56z" fill={FUR} stroke={FUR} strokeWidth="8" strokeLinejoin="round" />
      <path d="M152 76 144 22 102 56z" fill={FUR} stroke={FUR} strokeWidth="8" strokeLinejoin="round" />
      <path d="M58 66 61 40 82 56z" fill={FUR_DARK} /><path d="M142 66 139 40 118 56z" fill={FUR_DARK} />
      <ellipse cx="100" cy="110" rx="60" ry="50" fill={FUR} />
      <path d="M92 66q8-6 16 0M84 62q16-10 32 0" fill="none" stroke={FUR_DARK} strokeWidth="3" strokeLinecap="round" />
      <ellipse cx="100" cy="134" rx="26" ry="18" fill={LIGHT} />
      <circle cx="62" cy="124" r="9" fill={CHEEK} /><circle cx="138" cy="124" r="9" fill={CHEEK} />
      <Eyes pose={pose} />
      <path d="M94 121h12l-6 7z" fill={TONGUE} stroke={TONGUE} strokeWidth="2" strokeLinejoin="round" />
      <Mouth pose={pose} species="cat" />
      <g stroke={INK} strokeWidth="2" strokeLinecap="round" opacity=".55"><path d="M60 130 38 126M60 138 40 144M140 130 162 126M140 138 160 144" /></g>
    </g>
  );
}

function Extras({ pose }: { pose: MascotPose }): ReactNode {
  if (pose === 'welcome') {
    return (
      <g>
        <ellipse cx="172" cy="150" rx="14" ry="18" fill={FUR_DARK} transform="rotate(-18 172 150)" />
        <g fill="none" stroke={BRAND} strokeWidth="3.500" strokeLinecap="round"><path d="M178 116q10 6 6 18" /><path d="M188 110q14 10 8 28" /></g>
      </g>
    );
  }
  if (pose === 'searching') {
    return (
      <g>
        <circle cx="150" cy="140" r="22" fill="color-mix(in oklab, var(--ph-surface) 55%, transparent)" stroke={BRAND} strokeWidth="6" />
        <path d="m166 157 22 22" stroke={BRAND} strokeWidth="8" strokeLinecap="round" />
        <path d="M138 134q6-8 16-6" fill="none" stroke={LIGHT} strokeWidth="3" strokeLinecap="round" opacity=".9" />
      </g>
    );
  }
  if (pose === 'sleeping') {
    return (
      <g fill={BRAND} fontFamily="var(--ph-font-heading)" fontWeight="800">
        <text x="150" y="60" fontSize="26">z</text><text x="166" y="38" fontSize="20" opacity=".8">z</text><text x="178" y="20" fontSize="15" opacity=".6">z</text>
      </g>
    );
  }
  return (
    <g fill={SPARK}>
      <path d="m30 40 4 10 10 4-10 4-4 10-4-10-10-4 10-4z" /><path d="m170 30 3 8 8 3-8 3-3 8-3-8-8-3 8-3z" />
      <circle cx="22" cy="104" r="4" fill={BRAND} /><circle cx="184" cy="92" r="4" fill={BRAND} /><circle cx="150" cy="14" r="3" />
      <path d="m24 150 3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill={BRAND} />
    </g>
  );
}

export function Mascot({ pose = 'welcome', species = 'dog', size = 160, title, className }: { pose?: MascotPose; species?: MascotSpecies; size?: number; title?: string; className?: string }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} className={className} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} focusable="false">
      {title ? <title>{title}</title> : null}
      {species === 'cat' ? <Cat pose={pose} /> : <Dog pose={pose} />}
      <Extras pose={pose} />
    </svg>
  );
}
