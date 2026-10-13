import { useEffect, useState } from 'react';

interface Request {
  message: string;
  ok: string;
  danger: boolean;
  resolve: (ok: boolean) => void;
}

let show: ((r: Request | null) => void) | null = null;

/**
 * In-page replacement for window.confirm(), which some embedded browsers block
 * (it silently returns false there). Resolves true when the player confirms.
 */
export function askConfirm(message: string, opts: { ok?: string; danger?: boolean } = {}): Promise<boolean> {
  return new Promise((resolve) => {
    if (!show) {
      resolve(window.confirm(message));
      return;
    }
    show({ message, ok: opts.ok ?? 'Confirm', danger: opts.danger ?? true, resolve });
  });
}

export function ConfirmHost() {
  const [req, setReq] = useState<Request | null>(null);

  useEffect(() => {
    show = setReq;
    return () => {
      show = null;
    };
  }, []);

  useEffect(() => {
    if (!req) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [req]);

  if (!req) return null;
  const close = (ok: boolean) => {
    req.resolve(ok);
    setReq(null);
  };
  return (
    <div className="overlay confirm-overlay" onMouseDown={(e) => e.target === e.currentTarget && close(false)}>
      <div className="modal confirm-modal" role="alertdialog" aria-modal="true" aria-label="Please confirm">
        <div className="modal-body">
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>{req.message}</p>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => close(false)}>
              Cancel
            </button>
            <button className={`btn ${req.danger ? 'btn-danger' : 'btn-primary'}`} autoFocus onClick={() => close(true)}>
              {req.ok}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
