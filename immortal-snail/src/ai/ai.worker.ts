/// <reference lib="webworker" />
import { chooseMove, type AiRequest } from './search';

export interface AiJob {
  id: number;
  req: AiRequest;
}

self.onmessage = (e: MessageEvent<AiJob>) => {
  const { id, req } = e.data;
  try {
    self.postMessage({ id, result: chooseMove(req) });
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
