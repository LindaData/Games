import { memo } from 'react';
import { CLASSES, SPECIES } from '../game/data';
import type { AdvClass, SpeciesId } from '../game/types';

/** Shift a hex color's hue (degrees) and lightness (percentage points). */
export function shade(hex: string, hueShift = 0, lightShift = 0): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) / 255;
  let g = ((n >> 8) & 255) / 255;
  let b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return `hsl(${Math.round(h + hueShift)}, ${Math.round(s * 100)}%, ${Math.max(4, Math.min(96, Math.round(l * 100 + lightShift)))}%)`;
}

const SKIN = ['#f1c9a5', '#d9a47c', '#b57a52', '#8a5a3a', '#e8b98f', '#c68d63'];

interface Props {
  kind: SpeciesId | AdvClass;
  hue?: number;
  size?: number;
  className?: string;
  dead?: boolean;
}

function isSpecies(k: string): k is SpeciesId {
  return k in SPECIES;
}

export const Avatar = memo(function Avatar({ kind, hue = 0, size = 64, className, dead }: Props) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={`avatar ${className ?? ''} ${dead ? 'avatar-dead' : ''}`}
      aria-hidden="true"
    >
      {isSpecies(kind) ? <Monster kind={kind} hue={hue} /> : <Hero cls={kind} hue={hue} />}
    </svg>
  );
});

function Eyes({ y = 30, dx = 7, cx = 32, r = 3, color = '#1a1320', glow }: { y?: number; dx?: number; cx?: number; r?: number; color?: string; glow?: string }) {
  return (
    <g>
      {glow && <circle cx={cx - dx} cy={y} r={r + 2.5} fill={glow} opacity={0.35} />}
      {glow && <circle cx={cx + dx} cy={y} r={r + 2.5} fill={glow} opacity={0.35} />}
      <circle cx={cx - dx} cy={y} r={r} fill={color} />
      <circle cx={cx + dx} cy={y} r={r} fill={color} />
      {!glow && <circle cx={cx - dx + 1} cy={y - 1} r={r / 3} fill="#fff" />}
      {!glow && <circle cx={cx + dx + 1} cy={y - 1} r={r / 3} fill="#fff" />}
    </g>
  );
}

function Shoulders({ color, collar }: { color: string; collar?: string }) {
  return (
    <g>
      <path d="M8 64 C10 50 20 45 32 45 C44 45 54 50 56 64 Z" fill={color} />
      {collar && <path d="M26 46 L32 54 L38 46 Z" fill={collar} />}
    </g>
  );
}

function Monster({ kind, hue }: { kind: SpeciesId; hue: number }) {
  const base = SPECIES[kind].color;
  const c = shade(base, hue);
  const dark = shade(base, hue, -18);
  const light = shade(base, hue, 14);
  switch (kind) {
    case 'slime':
      return (
        <g>
          <ellipse cx="32" cy="58" rx="24" ry="4" fill="#000" opacity="0.25" />
          <path d="M8 56 C6 36 18 18 32 18 C46 18 58 36 56 56 C50 60 14 60 8 56 Z" fill={c} opacity="0.92" />
          <path d="M14 44 C14 32 22 24 30 23" stroke={light} strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.7" />
          <circle cx="44" cy="46" r="3" fill={light} opacity="0.6" />
          <circle cx="20" cy="50" r="2" fill={dark} opacity="0.6" />
          <Eyes y={36} dx={8} r={3.5} />
          <path d="M27 45 Q32 49 37 45" stroke="#1a1320" strokeWidth="2" fill="none" strokeLinecap="round" />
          <rect x="29" y="50" width="6" height="8" rx="1" fill="#e6e0ef" />
          <path d="M28 44 L32 50 L36 44" stroke="#5a9ad8" strokeWidth="1.5" fill="none" />
        </g>
      );
    case 'goblin':
      return (
        <g>
          <Shoulders color="#4a6a8a" collar="#2f4660" />
          <path d="M14 30 L1 18 L18 25 Z" fill={c} />
          <path d="M50 30 L63 18 L46 25 Z" fill={c} />
          <ellipse cx="32" cy="32" rx="15" ry="14" fill={c} />
          <path d="M18 24 C22 14 42 14 46 24 L46 21 C44 11 20 11 18 21 Z" fill="#3a5a7a" />
          <rect x="17" y="20" width="30" height="4" rx="2" fill="#2f4660" />
          <Eyes y={31} dx={6} r={2.8} color="#f2d24a" glow={undefined} />
          <circle cx="26" cy="31" r="1.3" fill="#1a1320" />
          <circle cx="38" cy="31" r="1.3" fill="#1a1320" />
          <path d="M32 33 L30 38 L34 38 Z" fill={dark} />
          <path d="M24 41 Q32 46 40 41" stroke="#1a1320" strokeWidth="2" fill="#2a1a1a" />
          <path d="M27 42 L28 44.5 L29 42.5 M35 42.5 L36 44.5 L37 42" fill="#fff" stroke="#fff" strokeWidth="0.8" />
        </g>
      );
    case 'skeleton':
      return (
        <g>
          <Shoulders color="#2d3a55" collar="#1d2740" />
          <rect x="40" y="52" width="8" height="6" rx="1" fill="#d9a441" />
          <ellipse cx="32" cy="30" rx="14" ry="15" fill={c} />
          <rect x="24" y="38" width="16" height="9" rx="3" fill={c} />
          <path d="M16 22 C18 10 46 10 48 22 L50 22 L50 25 L14 25 L14 22 Z" fill="#1d2740" />
          <rect x="24" y="15" width="16" height="4" rx="1" fill="#d9a441" />
          <ellipse cx="26" cy="31" rx="4" ry="4.5" fill="#1a1320" />
          <ellipse cx="38" cy="31" rx="4" ry="4.5" fill="#1a1320" />
          <circle cx="26" cy="31" r="1.3" fill="#ff5a4a" />
          <circle cx="38" cy="31" r="1.3" fill="#ff5a4a" />
          <path d="M32 35 L30 39 L34 39 Z" fill="#1a1320" />
          <path d="M26 42 L38 42 M28 40 L28 45 M32 40 L32 45 M36 40 L36 45" stroke={dark} strokeWidth="1.2" />
        </g>
      );
    case 'orc':
      return (
        <g>
          <Shoulders color="#5a4a3a" collar="#3a2e24" />
          <path d="M6 56 C8 48 16 46 22 48 L20 64 L6 64 Z M58 56 C56 48 48 46 42 48 L44 64 L58 64 Z" fill="#7a7a82" />
          <ellipse cx="32" cy="32" rx="17" ry="16" fill={c} />
          <path d="M14 26 C14 12 50 12 50 26 L50 22 C48 8 16 8 14 22 Z" fill="#6a6a72" />
          <rect x="30" y="14" width="4" height="14" fill="#6a6a72" />
          <path d="M20 26 L28 28 M44 26 L36 28" stroke={dark} strokeWidth="3" strokeLinecap="round" />
          <Eyes y={31} dx={7} r={2.6} color="#c0392b" />
          <ellipse cx="32" cy="36" rx="4" ry="2.5" fill={dark} />
          <path d="M22 41 Q32 47 42 41 L42 44 Q32 49 22 44 Z" fill="#2a1a1a" />
          <path d="M24 44 L25 35 L28 42 Z M40 44 L39 35 L36 42 Z" fill="#f4ecd8" />
        </g>
      );
    case 'mimic':
      return (
        <g>
          <ellipse cx="32" cy="59" rx="24" ry="4" fill="#000" opacity="0.25" />
          <rect x="8" y="34" width="48" height="24" rx="3" fill={c} />
          <path d="M8 30 C8 14 56 14 56 30 L56 34 L8 34 Z" fill={light} transform="rotate(-12 8 34)" />
          <path d="M10 34 L54 34 L54 38 L10 38 Z" fill="#2a1414" />
          <path d="M12 34 L15 40 L18 34 L21 40 L24 34 L27 40 L30 34 L33 40 L36 34 L39 40 L42 34 L45 40 L48 34 L51 40 L54 34" fill="#f4ecd8" />
          <path d="M22 38 Q32 52 44 38" fill="#c0395a" />
          <rect x="8" y="44" width="48" height="3" fill="#d9a441" />
          <rect x="29" y="42" width="6" height="8" rx="1" fill="#d9a441" />
          <rect x="8" y="34" width="3" height="24" fill="#d9a441" />
          <rect x="53" y="34" width="3" height="24" fill="#d9a441" />
          <circle cx="24" cy="24" r="3.5" fill="#f2d24a" transform="rotate(-12 8 34)" />
          <circle cx="40" cy="20" r="3.5" fill="#f2d24a" transform="rotate(-12 8 34)" />
          <circle cx="24" cy="24" r="1.4" fill="#1a1320" transform="rotate(-12 8 34)" />
          <circle cx="40" cy="20" r="1.4" fill="#1a1320" transform="rotate(-12 8 34)" />
        </g>
      );
    case 'witch':
      return (
        <g>
          <Shoulders color="#3a2a5a" collar="#2a1d44" />
          <ellipse cx="32" cy="35" rx="13" ry="13" fill={shade('#9cc47a', hue)} />
          <path d="M16 36 C14 46 18 52 20 54 L22 36 Z M48 36 C50 46 46 52 44 54 L42 36 Z" fill="#2a1a2a" />
          <path d="M6 28 Q32 20 58 28 Q32 32 6 28 Z" fill="#2a1d44" />
          <path d="M20 26 L34 0 L44 26 Z" fill="#2a1d44" />
          <path d="M34 0 L44 6" stroke="#2a1d44" strokeWidth="3" />
          <rect x="21" y="22" width="22" height="4" fill={c} />
          <Eyes y={34} dx={5.5} r={2.2} />
          <path d="M32 35 L36 41 L31 40 Z" fill={shade('#7aa45a', hue)} />
          <path d="M27 44 Q32 46 37 44" stroke="#1a1320" strokeWidth="1.5" fill="none" />
          <rect x="22" y="31" width="8" height="5" rx="2" fill="none" stroke="#d9a441" strokeWidth="1" />
          <rect x="34" y="31" width="8" height="5" rx="2" fill="none" stroke="#d9a441" strokeWidth="1" />
        </g>
      );
    case 'vampire':
      return (
        <g>
          <path d="M4 64 L10 40 L22 46 L32 60 L42 46 L54 40 L60 64 Z" fill={c} />
          <Shoulders color="#1a1420" collar="#e6e0ef" />
          <path d="M28 46 L32 58 L36 46 Z" fill={c} />
          <ellipse cx="32" cy="31" rx="13" ry="15" fill="#e8e0ec" />
          <path d="M18 26 C18 12 46 12 46 26 L32 20 Z" fill="#1a1420" />
          <Eyes y={30} dx={5.5} r={2.3} color="#c0392b" glow="#ff3a3a" />
          <path d="M26 40 Q32 43 38 40" stroke="#6a2a3a" strokeWidth="1.5" fill="none" />
          <path d="M28.5 40.5 L29.5 44 L30.5 41 M33.5 41 L34.5 44 L35.5 40.5" fill="#fff" stroke="#fff" strokeWidth="0.6" />
          <path d="M20 22 L14 10 L24 20 M44 22 L50 10 L40 20" fill="none" />
        </g>
      );
    case 'dragon':
      return (
        <g>
          <path d="M2 40 L14 20 L20 42 Z M62 40 L50 20 L44 42 Z" fill={dark} opacity="0.9" />
          <Shoulders color="#2a2a3a" collar="#c0392b" />
          <rect x="29" y="46" width="6" height="14" fill="#c0392b" />
          <path d="M20 22 L14 4 L26 18 Z M44 22 L50 4 L38 18 Z" fill="#f4ecd8" />
          <path d="M16 32 C16 16 48 16 48 32 C48 44 42 48 32 48 C22 48 16 44 16 32 Z" fill={c} />
          <path d="M22 38 C22 34 42 34 42 38 C42 46 22 46 22 38 Z" fill={light} />
          <circle cx="28" cy="38" r="1.2" fill="#1a1320" />
          <circle cx="36" cy="38" r="1.2" fill="#1a1320" />
          <path d="M20 28 L28 30 M44 28 L36 30" stroke={dark} strokeWidth="2.5" strokeLinecap="round" />
          <Eyes y={30} dx={8} r={2.4} color="#f2a02a" glow="#ffcc40" />
          <path d="M24 44 L26 47 L28 44 M36 44 L38 47 L40 44" fill="#fff" />
        </g>
      );
  }
}

function Hero({ cls, hue }: { cls: AdvClass; hue: number }) {
  const skin = SKIN[Math.abs(Math.round(hue)) % SKIN.length];
  const main = shade(CLASSES[cls].color, hue * 0.5);
  const dark = shade(CLASSES[cls].color, hue * 0.5, -20);
  const head = <ellipse cx="32" cy="32" rx="12" ry="13" fill={skin} />;
  const eyes = <Eyes y={32} dx={5} r={1.8} />;
  const mouth = <path d="M28 40 Q32 42 36 40" stroke="#5a2a2a" strokeWidth="1.5" fill="none" />;
  switch (cls) {
    case 'fighter':
      return (
        <g>
          <Shoulders color={main} collar={dark} />
          {head}
          {eyes}
          {mouth}
          <path d="M18 30 C18 14 46 14 46 30 L46 26 L18 26 Z" fill="#9aa4b0" />
          <path d="M18 30 C18 16 46 16 46 30 L42 30 L42 26 L22 26 L22 30 Z" fill="#b8c0ca" />
          <rect x="30" y="24" width="4" height="12" fill="#9aa4b0" />
        </g>
      );
    case 'rogue':
      return (
        <g>
          <Shoulders color={main} />
          <path d="M14 44 C12 20 20 12 32 12 C44 12 52 20 50 44 Z" fill={dark} />
          {head}
          <rect x="20" y="36" width="24" height="10" rx="3" fill={dark} />
          <path d="M22 30 L42 30 L40 34 L24 34 Z" fill="#1a1320" opacity="0.5" />
          <Eyes y={32} dx={5} r={1.8} color="#e8e0ec" glow={undefined} />
          <circle cx="27" cy="32" r="0.9" fill="#1a1320" />
          <circle cx="37" cy="32" r="0.9" fill="#1a1320" />
          <path d="M20 26 C22 16 42 16 44 26 C40 22 24 22 20 26 Z" fill={dark} />
        </g>
      );
    case 'wizard':
      return (
        <g>
          <Shoulders color={main} collar={dark} />
          {head}
          {eyes}
          <path d="M20 38 C20 52 28 58 32 60 C36 58 44 52 44 38 Q32 44 20 38 Z" fill="#e8e0ec" />
          <path d="M6 26 Q32 18 58 26 Q32 30 6 26 Z" fill={dark} />
          <path d="M18 25 L30 0 L46 25 Z" fill={main} />
          <circle cx="36" cy="14" r="2" fill="#f2d24a" />
          <circle cx="28" cy="19" r="1.3" fill="#f2d24a" />
        </g>
      );
    case 'cleric':
      return (
        <g>
          <Shoulders color="#e8e0d0" collar={main} />
          <path d="M16 40 C14 18 22 12 32 12 C42 12 50 18 48 40 L44 40 L44 28 L20 28 L20 40 Z" fill="#e8e0d0" />
          {head}
          {eyes}
          {mouth}
          <circle cx="32" cy="20" r="4" fill={main} />
          <path d="M32 14 L32 26 M26 20 L38 20" stroke="#f2d24a" strokeWidth="1.3" />
          <rect x="30" y="50" width="4" height="10" fill="#d9a441" />
          <rect x="27" y="53" width="10" height="3" fill="#d9a441" />
        </g>
      );
    case 'paladin':
      return (
        <g>
          <Shoulders color="#d0d0e0" collar="#d9a441" />
          <path d="M6 56 C8 46 16 44 22 46 L20 64 L6 64 Z M58 56 C56 46 48 44 42 46 L44 64 L58 64 Z" fill="#b8b8c8" />
          <path d="M18 34 C18 12 46 12 46 34 L46 44 C46 48 18 48 18 44 Z" fill="#c8c8d8" />
          <rect x="21" y="29" width="22" height="3" rx="1" fill="#1a1320" />
          <path d="M32 16 L32 46" stroke="#d9a441" strokeWidth="3" />
          <path d="M24 38 L40 38" stroke="#d9a441" strokeWidth="2" />
          <path d="M32 12 C36 4 44 6 44 12" stroke={main} strokeWidth="3" fill="none" />
        </g>
      );
    case 'ranger':
      return (
        <g>
          <Shoulders color={main} collar={dark} />
          <path d="M16 42 C14 20 22 12 32 12 C42 12 50 20 48 42 L44 42 L44 30 L20 30 L20 42 Z" fill={dark} />
          {head}
          {eyes}
          {mouth}
          <path d="M44 20 L58 6 L52 18 Z" fill="#c0392b" />
          <path d="M50 44 L60 30" stroke="#8a6a3a" strokeWidth="2" />
        </g>
      );
    case 'barbarian':
      return (
        <g>
          <Shoulders color={skin} />
          <path d="M20 50 L44 50" stroke="#6a4a2a" strokeWidth="3" />
          <path d="M14 36 C10 22 20 10 32 10 C44 10 54 22 50 36 C48 30 46 26 32 26 C18 26 16 30 14 36 Z" fill={shade('#8a4a2a', hue)} />
          {head}
          <path d="M22 28 L28 30 M42 28 L36 30" stroke="#3a1a1a" strokeWidth="2" strokeLinecap="round" />
          <Eyes y={33} dx={5} r={1.8} />
          <path d="M26 39 L38 39" stroke="#5a2a2a" strokeWidth="2" />
          <path d="M20 44 C22 52 42 52 44 44 C40 48 24 48 20 44 Z" fill={shade('#8a4a2a', hue)} />
          <path d="M16 18 L6 6 L18 14 Z M48 18 L58 6 L46 14 Z" fill="#e8e0d0" />
        </g>
      );
    case 'bard':
      return (
        <g>
          <Shoulders color={main} collar="#f2d24a" />
          {head}
          {eyes}
          <path d="M27 39 Q32 44 37 39" stroke="#5a2a2a" strokeWidth="1.5" fill="#fff" />
          <path d="M16 26 Q32 14 48 26 L46 22 Q32 10 18 22 Z" fill={dark} />
          <path d="M44 20 Q56 6 60 14 Q52 14 46 22 Z" fill="#f2d24a" />
          <ellipse cx="48" cy="54" rx="6" ry="7" fill="#b07a3c" />
          <rect x="47" y="38" width="2" height="12" fill="#6a4a2a" />
        </g>
      );
  }
}
