import { randomUUID } from "node:crypto";

/** Deliberately exclude provider bodies, prompts, headers and arbitrary error messages. */
export function errorInfo(error: unknown, depth = 0): ErrorInfo {
  const e = (error && typeof error === "object" ? error : {}) as Record<string, unknown>;
  const token = (value: unknown) =>
    typeof value === "string" && /^[\w.-]{1,80}$/.test(value) ? value : undefined;
  const message = typeof e.message === "string" ? e.message : "";
  const category = /overload|high demand|capacity/i.test(message)
    ? "overloaded"
    : /rate.?limit|too many requests/i.test(message)
      ? "rate_limit"
      : /timeout|timed out/i.test(message)
        ? "timeout"
        : /unauthori|authentication|api.?key/i.test(message)
          ? "authentication"
          : /network|fetch failed|ENOTFOUND|ECONN/i.test(message)
            ? "network"
            : /schema|validation|parse/i.test(message)
              ? "validation"
              : "other";
  return {
    name: token(e.name) ?? "Error",
    category,
    code: token(e.code),
    status: typeof e.statusCode === "number" ? e.statusCode : undefined,
    retryable: typeof e.isRetryable === "boolean" ? e.isRetryable : undefined,
    cause: e.cause && depth < 3 ? errorInfo(e.cause, depth + 1) : undefined,
  };
}
export interface ErrorInfo {
  name: string;
  category: string;
  code?: string;
  status?: number;
  retryable?: boolean;
  cause?: ErrorInfo;
}
export interface ModelEvent {
  type:
    | "request.started"
    | "request.succeeded"
    | "request.failed"
    | "attempt.started"
    | "attempt.failed"
    | "request.retry"
    | "cache.hit";
  model: string;
  requestId?: string;
  attempt?: number;
  durationMs?: number;
  delayMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  error?: ErrorInfo;
  source?: "memory" | "inflight";
}
export type ObserveModel = (event: ModelEvent) => void;

export function traceRequest(model: string, observe?: ObserveModel) {
  const requestId = randomUUID();
  const started = performance.now();
  let attempt = 0;
  const emit = (event: Omit<ModelEvent, "model" | "requestId">) => observe?.({ ...event, model, requestId });
  emit({ type: "request.started" });
  return {
    async attempt<T>(fn: () => PromiseLike<T>): Promise<T> {
      attempt++;
      emit({ type: "attempt.started", attempt });
      const start = performance.now();
      try {
        return await fn();
      } catch (error) {
        emit({
          type: "attempt.failed",
          attempt,
          durationMs: Math.round(performance.now() - start),
          error: errorInfo(error),
        });
        throw error;
      }
    },
    retry(delayMs: number) {
      emit({ type: "request.retry", attempt, delayMs });
    },
    success(usage: { inputTokens?: number; outputTokens?: number } = {}) {
      emit({
        type: "request.succeeded",
        attempt,
        durationMs: Math.round(performance.now() - started),
        ...usage,
      });
    },
    failure(error: unknown) {
      emit({
        type: "request.failed",
        attempt,
        durationMs: Math.round(performance.now() - started),
        error: errorInfo(error),
      });
    },
  };
}
