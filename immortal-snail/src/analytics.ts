/**
 * Play statistics for the owner: Vercel Web Analytics (page views, plus the custom events below).
 * Cookieless and anonymous; no personal data is ever sent. Only on the built web version served
 * over http(s) from a real host: never in dev, never on localhost, never in the desktop app
 * (app://), so nothing there ever talks to the network.
 *
 * Custom events need Vercel Pro (page views work on every plan).
 */
import { inject, track as vercelTrack } from '@vercel/analytics';
import type { Cause, Outcome } from './game/engine';
import type { Mode } from './game/settings';

export type AnalyticsEvent =
  | { name: 'game_start'; props: { mode: Mode } }
  | { name: 'game_end'; props: { mode: Mode; result: Outcome; cause: Cause; turns: number } }
  | { name: 'share'; props: { kind: 'link' | 'result'; method: 'native' | 'copy' } }
  | { name: 'install_hint'; props: { action: 'shown' | 'dismissed' } };

/** Production build, http(s), and not a local address. */
export function analyticsAllowed(loc: { protocol: string; hostname: string }, production: boolean): boolean {
  if (!production || (loc.protocol !== 'https:' && loc.protocol !== 'http:')) return false;
  const host = loc.hostname.replace(/^\[|\]$/g, '');
  return !(host === 'localhost' || host.endsWith('.localhost') || host === '::1' || /^127\./.test(host) || host === '0.0.0.0');
}

let enabled = false;

export function initAnalytics(): void {
  if (enabled || !analyticsAllowed(window.location, import.meta.env.PROD)) return;
  try {
    inject({ mode: 'production', framework: 'react' });
    enabled = true;
  } catch {
    /* blocked or failed: play on without stats */
  }
}

type PropsOf<N extends AnalyticsEvent['name']> = Extract<AnalyticsEvent, { name: N }>['props'];

export function track<N extends AnalyticsEvent['name']>(name: N, props: PropsOf<N>): void {
  if (!enabled) return;
  try {
    vercelTrack(name, props);
  } catch {
    /* never let stats break the game */
  }
}
