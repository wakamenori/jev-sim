import { experimental_evaluate as evaluate } from "ai";
import type { Answers, Evaluate, Questions } from "./evaluation.ts";
import { cacheKey, createCache } from "./model-cache.ts";
import { type ObserveModel, traceRequest } from "./model-events.ts";
export const MODEL = "typesafe-ai/jev";
type Request = (state: string, questions: Questions) => Promise<{ answers: Answers; inputTokens: number }>;
const request: Request = async (state, questions) => {
  const r = await evaluate({ model: MODEL, state, questions, maxRetries: 0 });
  return { answers: r.answers as Answers, inputTokens: r.usage.inputTokens ?? 0 };
};

export function createJevClient(
  options: { cachePath?: string; request?: Request; observe?: ObserveModel } = {},
) {
  const cache = createCache<Answers>(options.cachePath);
  const stats = { calls: 0, cacheHits: 0, inputTokens: 0, ms: 0, retries: 0 };
  const inFlight = new Map<string, Promise<Answers>>();
  let running = 0;
  const waiting: (() => void)[] = [];
  async function withLimit<T>(fn: () => Promise<T>): Promise<T> {
    if (running >= 32) await new Promise<void>((resolve) => waiting.push(resolve));
    else running++;
    try {
      return await fn();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else running--;
    }
  }
  /**
   * 提供元の「高負荷」エラーは約 0.2 秒で返るので、短い間隔で何度もやり直す。
   * SDK 内部の再試行は数秒単位で待つので使わない（maxRetries: 0）。
   */
  async function withBackoff<T>(
    fn: () => Promise<T>,
    trace: ReturnType<typeof traceRequest>,
    attempts = 30,
  ): Promise<T> {
    let delay = 150;
    for (let i = 0; ; i++) {
      try {
        return await trace.attempt(fn);
      } catch (e) {
        const retryable = (e as { isRetryable?: boolean }).isRetryable !== false;
        if (!retryable || i >= attempts - 1) throw e;
        stats.retries++;
        const delayMs = Math.round(delay * (0.5 + Math.random()));
        trace.retry(delayMs);
        await new Promise((r) => setTimeout(r, delayMs));
        delay = Math.min(delay * 1.5, 2000);
      }
    }
  }

  const ask: Evaluate = async (state, questions) => {
    const key = cacheKey({ MODEL, state, questions });
    const cached = cache.get(key);
    if (cached) {
      stats.cacheHits++;
      options.observe?.({ type: "cache.hit", model: MODEL, source: "memory" });
      return cached;
    }
    const pending = inFlight.get(key);
    if (pending) {
      stats.cacheHits++;
      options.observe?.({ type: "cache.hit", model: MODEL, source: "inflight" });
      return pending;
    }
    const promise = (async () => {
      const start = performance.now();
      const trace = traceRequest(MODEL, options.observe);
      let result: Awaited<ReturnType<Request>>;
      try {
        result = await withLimit(() =>
          withBackoff(() => (options.request ?? request)(state, questions), trace),
        );
        trace.success({ inputTokens: result.inputTokens });
      } catch (error) {
        trace.failure(error);
        throw error;
      }
      stats.ms += performance.now() - start;
      stats.calls++;
      stats.inputTokens += result.inputTokens;
      cache.set(key, result.answers);
      return result.answers;
    })();
    inFlight.set(key, promise);
    try {
      return await promise;
    } finally {
      inFlight.delete(key);
    }
  };
  return { ask, stats, saveCache: cache.flush };
}
