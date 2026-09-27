/// <reference lib="webworker" />
import { chooseEnemyMove, type AiRequest } from './search';

self.onmessage = (e: MessageEvent<{ id: number; req: AiRequest }>) => {
  const { id, req } = e.data;
  try {
    const result = chooseEnemyMove(req);
    self.postMessage({ id, result });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
