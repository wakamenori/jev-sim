import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { KING } from "./cast.ts";
import { type ChooseAction, chooseAction as defaultChooseAction } from "./decision.ts";
import { createJevClient, MODEL } from "./jev.ts";
import { createLlmClient } from "./llm.ts";
import type { ObserveModel } from "./model-events.ts";
import { createRunLog, writeJson } from "./run-log.ts";
import { simulate } from "./simulation.ts";
import type { World } from "./types.ts";
import { buildWorld } from "./world.ts";

export interface RunOptions {
  /** Stop after this day; the final day includes the King's decision. */
  until?: number;
  verbose?: boolean;
  label?: string;
  outputDir?: string;
  print?: (line: string) => void;
  /** CLI only: save diagnostics before terminating on SIGINT/SIGTERM. */
  handleSignals?: boolean;
}

export function createModelClients(observe?: ObserveModel) {
  return {
    ...createJevClient({ cachePath: "cache/jev-cache.json", observe }),
    ...createLlmClient("cache/llm-cache.json", observe),
  };
}

/** CLI-facing runner. Persistence and model clients stay outside the simulation. */
export async function runSim(
  opts: RunOptions = {},
  makeClients: typeof createModelClients = createModelClients,
  decorateChoice?: (choose: ChooseAction) => ChooseAction,
): Promise<{ world: World; file: string }> {
  if (opts.label && !/^[\w-]+$/.test(opts.label)) throw new Error("Invalid run label");
  const w = buildWorld();
  if (
    opts.until !== undefined &&
    (!Number.isInteger(opts.until) || opts.until < 0 || opts.until > w.totalDays)
  )
    throw new Error(`Invalid final day: ${opts.until}`);
  const meta = { model: MODEL, startedAt: new Date().toISOString() } as NonNullable<World["meta"]>;
  w.meta = meta;
  const runId = `${meta.startedAt.replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}${opts.label ? `-${opts.label}` : ""}`;
  const root = opts.outputDir ?? "out";
  const dir = join(root, "logs", runId);
  const print = opts.print ?? console.log;
  const log = createRunLog(dir, runId, print, opts.until ?? w.totalDays);
  let clients: ReturnType<typeof createModelClients> | undefined;
  const flushAfterFailure = () => {
    try {
      clients?.saveCache();
    } catch (error) {
      log.persistenceFailed(error);
    }
  };
  const savePartial = () => writeJson(join(dir, "partial-world.json"), w);
  const interrupt = (signal: NodeJS.Signals) => {
    try {
      flushAfterFailure();
      savePartial();
      log.finish("interrupted", Object.assign(new Error(signal), { code: signal }));
    } finally {
      process.exit(signal === "SIGINT" ? 130 : 143);
    }
  };
  if (opts.handleSignals) {
    process.once("SIGINT", interrupt);
    process.once("SIGTERM", interrupt);
  }
  try {
    writeJson(join(dir, "checkpoint.json"), w);
    clients = makeClients(log.observe);
    const before = { ...clients.stats };
    const { ask, generate } = clients;
    const chooseAction = decorateChoice?.((world, actor, support) =>
      defaultChooseAction(ask, world, actor, support),
    );
    await simulate(
      w,
      { ask, generate, chooseAction },
      opts.until,
      () => {
        writeJson(join(dir, "checkpoint.json"), w);
        log.dayCompleted(w.day);
        clients?.saveCache();
        if (opts.verbose)
          for (const e of w.events.filter((e) => e.day === w.day)) print(`#${e.id} ${e.text}`);
      },
      log.observePhase,
    );
    clients.saveCache();
    meta.finishedAt = new Date().toISOString();
    meta.jev = {
      calls: clients.stats.calls - before.calls,
      cacheHits: clients.stats.cacheHits - before.cacheHits,
      retries: clients.stats.retries - before.retries,
      inputTokens: clients.stats.inputTokens - before.inputTokens,
    };
    mkdirSync(join(root, "runs"), { recursive: true });
    const file = join(root, "runs", `${runId}.json`);
    writeJson(file, w);
    log.finish("completed", undefined, file);
    return { world: w, file };
  } catch (error) {
    flushAfterFailure();
    savePartial();
    log.finish("failed", error);
    throw error;
  } finally {
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", interrupt);
  }
}

export function supportTally(w: World): Record<string, string[]> {
  const tally: Record<string, string[]> = {};
  for (const [pid, m] of Object.entries(w.minds)) {
    if (pid === KING) continue;
    tally[m.support] ??= [];
    tally[m.support].push(pid);
  }
  return tally;
}
