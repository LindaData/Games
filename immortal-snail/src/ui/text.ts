/** The game's words: the rules, the three modes, the record line. */
import type { Mode } from '../game/settings';
import { SNAILS_EVERY } from '../game/settings';
import type { Stats } from '../storage';

/** The rules every mode shares. The mode's own rule comes 4th. */
export const RULES = [
  'You are White. Win by checkmate — or when your snail reaches their king.',
  `Every ${SNAILS_EVERY} turns, both snails crawl 1 square toward the enemy king.`,
  'If their snail touches your king, you lose.',
];

export const MOVE_HINT = 'Tap a piece, then tap a dot.';

export const MODE_INFO: Record<Mode, { name: string; short: string; rule: string }> = {
  ghost: { name: 'Ghost Snails', short: 'Ghost', rule: 'Snails slide over pieces. They never eat anything.' },
  hungry: { name: 'Hungry Snails', short: 'Hungry', rule: 'Snails eat enemy pieces they crawl onto.' },
  sacrifice: {
    name: 'Sacrifice Snails',
    short: 'Sacrifice',
    rule: 'Pick one of your pieces to give up. Your snail starts in its place.',
  },
};

export const recordText = (mode: Mode, s: Stats) => `${MODE_INFO[mode].short}: Wins ${s.w} · Losses ${s.l} · Draws ${s.d}`;
