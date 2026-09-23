import { appendFileSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { errorInfo, type ObserveModel } from "./model-events.ts";
import type { ObservePhase, Phase } from "./simulation.ts";

export function writeJson(path: string, value: unknown) {
  writeFileSync(`${path}.tmp`, JSON.stringify(value, null, 2));
  renameSync(`${path}.tmp`, path);
}

/** Full trace on disk; a bounded status document for monitoring without tailing the trace. */
export function createRunLog(dir: string, runId: string, print = console.log, targetDay?: number) {
  mkdirSync(dir, { recursive: true });
  const startedAt = new Date().toISOString();
  const started = performance.now();
  let status: "running" | "completed" | "failed" | "interrupted" = "running";
  let phase: (Phase & { startedAt: string }) | undefined;
  let phaseStart = started;
  let completedDay = 0;
  let finishedAt: string | undefined;
  let resultFile: string | undefined;
  let elapsedMs: number | undefined;
  let lastActivityAt = startedAt;
  let failure: ReturnType<typeof errorInfo> | undefined;
  const active = new Map<
    string,
    { model: string; startedAt: string; phase: typeof phase; attempt: number }
  >();
  const models: Record<
    string,
    {
      succeeded: number;
      failed: number;
      retries: number;
      cacheHits: number;
      inputTokens: number;
      outputTokens: number;
    }
  > = {};
  const errors: Record<string, number> = {};
  function event(type: string, data: object = {}) {
    lastActivityAt = new Date().toISOString();
    appendFileSync(
      join(dir, "events.jsonl"),
      `${JSON.stringify({ at: lastActivityAt, runId, type, ...data })}\n`,
    );
  }
  function saveStatus() {
    const oldest = active.entries().next().value;
    writeJson(join(dir, "status.json"), {
      runId,
      pid: process.pid,
      status,
      startedAt,
      finishedAt,
      resultFile,
      updatedAt: new Date().toISOString(),
      lastActivityAt,
      elapsedMs: elapsedMs ?? Math.round(performance.now() - started),
      targetDay,
      completedDay,
      phase,
      activeRequests: active.size,
      oldestRequest: oldest ? { requestId: oldest[0], ...oldest[1] } : undefined,
      models,
      errors,
      failure,
    });
  }
  const observe: ObserveModel = (entry) => {
    const now = new Date().toISOString();
    if (entry.type === "request.started" && entry.requestId)
      active.set(entry.requestId, { model: entry.model, startedAt: now, phase, attempt: 0 });
    const request = entry.requestId ? active.get(entry.requestId) : undefined;
    models[entry.model] ??= {
      succeeded: 0,
      failed: 0,
      retries: 0,
      cacheHits: 0,
      inputTokens: 0,
      outputTokens: 0,
    };
    const stats = models[entry.model];
    if (entry.type === "attempt.started" && request) {
      request.attempt = entry.attempt ?? 1;
      if (request.attempt > 1) stats.retries++;
    }
    if (entry.type === "cache.hit") stats.cacheHits++;
    if (entry.type === "attempt.failed" && entry.error) {
      const e = entry.error;
      const key = [e.name, e.status, e.code, e.category, e.cause?.code]
        .filter((v) => v !== undefined)
        .join(":");
      errors[key] = (errors[key] ?? 0) + 1;
    }
    if (entry.type === "request.succeeded") {
      stats.succeeded++;
      stats.inputTokens += entry.inputTokens ?? 0;
      stats.outputTokens += entry.outputTokens ?? 0;
    }
    if (entry.type === "request.failed") stats.failed++;
    event(entry.type, { ...entry, phase: request?.phase ?? phase });
    if (entry.requestId && (entry.type === "request.succeeded" || entry.type === "request.failed"))
      active.delete(entry.requestId);
    // Late completions from a failed parallel batch must not revert its terminal status.
    if (status !== "running") saveStatus();
  };
  const observePhase: ObservePhase = (value, transition) => {
    if (transition === "started") {
      phase = { ...value, startedAt: new Date().toISOString() };
      phaseStart = performance.now();
    }
    event(`phase.${transition}`, {
      phase,
      durationMs: transition === "completed" ? Math.round(performance.now() - phaseStart) : undefined,
    });
    saveStatus();
  };
  event("run.started", { targetDay });
  saveStatus();
  print(`[run] started ${runId}\n[log] ${join(dir, "status.json")}`);
  const timer = setInterval(saveStatus, 1000);
  timer.unref();
  return {
    observe,
    observePhase,
    persistenceFailed(error: unknown) {
      event("persistence.failed", { error: errorInfo(error) });
    },
    dayCompleted(day: number) {
      completedDay = day;
      event("day.completed", { day });
      saveStatus();
      print(`[day ${day}] completed`);
    },
    finish(result: "completed" | "failed" | "interrupted", error?: unknown, file?: string) {
      if (status !== "running") return;
      clearInterval(timer);
      elapsedMs = Math.round(performance.now() - started);
      status = result;
      resultFile = file;
      finishedAt = new Date().toISOString();
      failure = error === undefined ? undefined : errorInfo(error);
      event(`run.${result}`, { error: failure, file, phase });
      saveStatus();
      const note =
        result === "completed" && Object.values(models).some((model) => model.retries > 0)
          ? " (recovered retries; see log)"
          : "";
      print(`[run] ${result}${note}${file ? ` -> ${file}` : ""} (${join(dir, "status.json")})`);
    },
  };
}
