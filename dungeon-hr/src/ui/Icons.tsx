import type { ReactNode } from 'react';
import type { RoomTypeId } from '../game/types';

type IconName =
  | RoomTypeId
  | 'gold'
  | 'flask'
  | 'skull'
  | 'heart'
  | 'moon'
  | 'sun'
  | 'users'
  | 'door'
  | 'plus'
  | 'arrow'
  | 'sword'
  | 'shield'
  | 'star'
  | 'mail'
  | 'book'
  | 'sound'
  | 'mute'
  | 'menu'
  | 'close'
  | 'lock'
  | 'up'
  | 'warn'
  | 'chart'
  | 'bolt';

const P: Record<IconName, ReactNode> = {
  hallway: (
    <>
      <path d="M8 21V11a4 4 0 0 1 8 0v10" />
      <path d="M12 3c1.5 1.5 1.5 3 0 4.5C10.5 6 10.5 4.5 12 3z" fill="currentColor" />
      <path d="M4 21h16" />
    </>
  ),
  guardpost: <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z" />,
  trap: (
    <>
      <path d="M3 20h18" />
      <path d="M5 20l2-8 2 8M10 20l2-10 2 10M15 20l2-8 2 8" />
    </>
  ),
  ambush: (
    <>
      <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" fill="currentColor" />
    </>
  ),
  lair: <path d="M3 18l2-11 4.5 5L12 5l2.5 7L19 7l2 11z" />,
  vault: (
    <>
      <rect x="3" y="9" width="18" height="11" rx="1.5" />
      <path d="M3 9c0-4 18-4 18 0M3 13h18" />
      <rect x="10.5" y="11.5" width="3" height="4" rx="0.5" fill="currentColor" />
    </>
  ),
  barracks: (
    <>
      <path d="M3 19V8M21 19v-5M3 14h18" />
      <rect x="6" y="10" width="4" height="4" rx="1" />
    </>
  ),
  breakroom: (
    <>
      <path d="M5 9h11v6a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z" />
      <path d="M16 11h2a2 2 0 0 1 0 4h-2M8 3c0 2 2 2 2 4M12 3c0 2 2 2 2 4" />
    </>
  ),
  training: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
    </>
  ),
  medical: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="4" />
      <path d="M12 7v10M7 12h10" />
    </>
  ),
  cafeteria: (
    <>
      <path d="M4 12h16a8 8 0 0 1-16 0z" />
      <path d="M8 8c0-2 2-2 2-4M13 8c0-2 2-2 2-4" />
    </>
  ),
  hroffice: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 3h6v3H9zM8 11h8M8 15h5" />
    </>
  ),
  lab: (
    <>
      <path d="M9 3h6M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3" />
      <path d="M7 15h10" />
    </>
  ),
  accounting: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6" />
    </>
  ),
  gold: (
    <>
      <circle cx="12" cy="12" r="8.5" fill="currentColor" fillOpacity="0.2" />
      <circle cx="12" cy="12" r="5.5" />
    </>
  ),
  flask: (
    <>
      <path d="M9 3h6M10 3v5L5 18a2 2 0 0 0 1.8 3h10.4A2 2 0 0 0 19 18l-5-10V3" />
      <circle cx="11" cy="16" r="1" fill="currentColor" />
      <circle cx="14" cy="13" r="0.8" fill="currentColor" />
    </>
  ),
  skull: (
    <>
      <path d="M12 3a8 8 0 0 0-5 14.2V20h10v-2.8A8 8 0 0 0 12 3z" />
      <circle cx="9" cy="11" r="1.8" fill="currentColor" />
      <circle cx="15" cy="11" r="1.8" fill="currentColor" />
      <path d="M10 20v-3M14 20v-3" />
    </>
  ),
  heart: <path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.5-7 10-7 10z" />,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />,
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2 20c0-4 3-6 7-6s7 2 7 6" />
      <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14c2.5.5 4 2.5 4 6" />
    </>
  ),
  door: (
    <>
      <path d="M5 21V5a7 7 0 0 1 14 0v16z" />
      <circle cx="15" cy="13" r="1" fill="currentColor" />
      <path d="M3 21h18" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  arrow: <path d="M5 12h14M13 6l6 6-6 6" />,
  sword: <path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2" />,
  shield: <path d="M12 3l7 3v5c0 5-3.5 8.5-7 10-3.5-1.5-7-5-7-10V6z" />,
  star: <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" />,
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </>
  ),
  book: (
    <>
      <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
      <path d="M4 19V5M8 7h7" />
    </>
  ),
  sound: (
    <>
      <path d="M4 9h4l5-4v14l-5-4H4z" />
      <path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11" />
    </>
  ),
  mute: (
    <>
      <path d="M4 9h4l5-4v14l-5-4H4z" />
      <path d="M17 9l5 6M22 9l-5 6" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  up: <path d="M12 19V5M6 11l6-6 6 6" />,
  warn: (
    <>
      <path d="M12 3L2 20h20z" />
      <path d="M12 10v4M12 17v.5" />
    </>
  ),
  chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  bolt: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
};

export function Icon({ name, size = 18, className, title }: { name: IconName; size?: number; className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icon ${className ?? ''}`}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
    >
      {title && <title>{title}</title>}
      {P[name]}
    </svg>
  );
}
