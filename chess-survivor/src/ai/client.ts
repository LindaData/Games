/** Promise-based client for the AI web worker, with a synchronous fallback. */
import { chooseEnemyMove, type AiRequest, type AiResult } from './search';

let worker: Worker | null = null;
let nextId = 1;
const pending = new Map<number, { resolve: (r: AiResult) => void; reject: (e: Error) => void }>();

function getWorker(): Worker | null {
  if (worker) return worker;
  if (typeof Worker === 'undefined') return null;
  try {
    worker = new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; result?: AiResult; error?: string }>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.result) p.resolve(e.data.result);
      else p.reject(new Error(e.data.error ?? 'AI error'));
    };
    return worker;
  } catch {
    return null;
  }
}

export function requestEnemyMove(req: AiRequest): Promise<AiResult> {
  const w = getWorker();
  if (!w) return Promise.resolve().then(() => chooseEnemyMove(req));
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    w.postMessage({ id, req });
  });
}
