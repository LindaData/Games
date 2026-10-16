/** Small pieces around the game: the share icon, the "Link copied" toast and the Add to Home Screen hint. */
import { useEffect, useRef, useState } from 'react';
import { track } from '../analytics';
import { currentDevice, shouldShowInstallHint } from '../pwa/installHint';
import { loadInstallHintDismissed, saveInstallHintDismissed } from '../storage';

/** The iOS-style share glyph: a box with an arrow out of the top. */
export function ShareIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`share-icon ${className ?? ''}`} aria-hidden="true">
      <path d="M12 3v11M7.5 7.5 12 3l4.5 4.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 10.5H6.5a1.5 1.5 0 0 0-1.5 1.5v7.5A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V12a1.5 1.5 0 0 0-1.5-1.5H16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export interface ToastMessage {
  id: number;
  text: string;
}

/** A short message at the bottom of the screen ("Link copied"), gone after a few seconds. */
export function Toast({ toast, onDone }: { toast: ToastMessage | null; onDone: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(onDone, 2600);
    return () => clearTimeout(t);
  }, [toast, onDone]);
  return (
    <div className="toast-slot" role="status" aria-live="polite">
      {toast && (
        <span key={toast.id} className="toast">
          {toast.text}
        </span>
      )}
    </div>
  );
}

/**
 * iPhone Safari, not on the home screen yet: how to get the game there. Shown until closed.
 * `covered`: a dialog is over the page. "shown" is counted once per page load, when the hint is
 * actually on screen and not covered.
 */
export function InstallHint({ covered, className }: { covered: boolean; className?: string }) {
  const [show, setShow] = useState(() => shouldShowInstallHint(currentDevice(), loadInstallHintDismissed()));
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const counted = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!show || !el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [show]);
  useEffect(() => {
    if (!show || !inView || covered || counted.current) return;
    counted.current = true;
    track('install_hint', { action: 'shown' });
  }, [show, inView, covered]);
  if (!show) return null;
  return (
    <div ref={ref} className={`install-hint panel ${className ?? ''}`}>
      <p className="min-w-0 flex-1 text-sm">
        Tap <ShareIcon className="inline-share" />
        <span className="sr-only">Share</span> then <strong>Add to Home Screen</strong> to play offline.
      </p>
      <button
        type="button"
        className="close-btn small"
        aria-label="Close"
        onClick={() => {
          saveInstallHintDismissed();
          track('install_hint', { action: 'dismissed' });
          setShow(false);
        }}
      >
        ×
      </button>
    </div>
  );
}
