/**
 * Promise-based client for the AI Web Worker, with a main-thread fallback when workers are
 * unavailable. Every request carries a tag (game id + position) that comes back with the
 * reply, so callers can ignore replies for a game or position that no longer exists.
 */
import { chooseMove, type AiRequest, type AiResult } from './search';

export interface AiTag {
  gameId: number;
  fen: string;
  ply: number;
}

export interface AiReply {
  tag: AiTag;
  result: AiResult;
}

/** Moves never arrive faster than this, so the computer doesn't feel instant. */
export const MIN_THINK_MS = 400;

type Pending = { resolve: (r: AiResult) => void; reject: (e: Error) => void };

let worker: Worker | null = null;
let workerBroken = false;
let nextId = 1;
const pending = new Map<number, Pending>();

function failAll(err: Error) {
  for (const p of pending.values()) p.reject(err);
  pending.clear();
}

function getWorker(): Worker | null {
  if (worker) return worker;
  if (workerBroken || typeof Worker === 'undefined') return null;
  try {
    worker = new Worker(new URL('./ai.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; result?: AiResult; error?: string }>) => {
      const p = pending.get(e.data.id);
      if (!p) return;
      pending.delete(e.data.id);
      if (e.data.result) p.resolve(e.data.result);
      else p.reject(new Error(e.data.error ?? 'AI error'));
    };
    worker.onerror = () => {
      workerBroken = true;
      worker?.terminate();
      worker = null;
      failAll(new Error('AI worker crashed'));
    };
    return worker;
  } catch {
    workerBroken = true;
    return null;
  }
}

function compute(req: AiRequest): Promise<AiResult> {
  const w = getWorker();
  if (!w) return Promise.resolve().then(() => chooseMove(req));
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { resolve, reject });
    w.postMessage({ id, req });
  }).then(
    (r) => r as AiResult,
    // A worker failure falls back to searching on the main thread.
    () => chooseMove(req),
  );
}

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Ask for the computer's move. Resolves no sooner than MIN_THINK_MS, with the request's tag. */
export async function requestAiMove(req: AiRequest, tag: AiTag, minMs = MIN_THINK_MS): Promise<AiReply> {
  const started = Date.now();
  const result = await compute(req);
  const wait = minMs - (Date.now() - started);
  if (wait > 0) await delay(wait);
  return { tag, result };
}
