import { mkdirSync, writeFileSync } from "node:fs";
import { KING } from "./cast.ts";
import { fmt, MODEL, saveCache, stats } from "./jev.ts";
import { llmStats } from "./llm.ts";
import { reviewAll } from "./review.ts";
import { buildWorld, candidates, closeDay, endDay, kingDecide, runTurn, startDay, TURNS } from "./sim.ts";
import { planAll } from "./strategy.ts";
import type { Override, World } from "./types.ts";

export interface RunOptions {
  /** N 日目まで回して止める（指名はしない） */
  until?: number;
  overrides?: Override[];
  forkOf?: string;
  /** 1 日ごとの出来事を標準出力に出す */
  verbose?: boolean;
  label?: string;
}

export async function runSim(opts: RunOptions = {}): Promise<{ world: World; file: string }> {
  const w = buildWorld();
  w.meta = {
    model: MODEL,
    startedAt: new Date().toISOString(),
    overrides: opts.overrides,
    forkOf: opts.forkOf,
  };
  const name = (id: string) => w.people[id]?.name ?? id;
  const until = Math.min(opts.until ?? w.totalDays, w.totalDays);
  const before = { ...stats };
  const t0 = performance.now();
  try {
    for (let d = 1; d <= until; d++) {
      const td = performance.now();
      const callsBefore = stats.calls;
      startDay(w);
      const tp = performance.now();
      const plans = await planAll(w);
      w.plans.push(...plans);
      const planSec = ((performance.now() - tp) / 1000).toFixed(1);
      for (let t = 1; t <= TURNS; t++) {
        w.turn = t;
        await runTurn(w);
        saveCache();
      }
      await endDay(w);
      saveCache();
      // 個人の整理（Luna、全員）: 他人の推測・頭目への報告・翌日の狙い
      const tr = performance.now();
      await reviewAll(w);
      closeDay(w);
      const reviewSec = ((performance.now() - tr) / 1000).toFixed(1);
      const s = w.kingSuitability.at(-1) ?? {};
      const kingLine = candidates(w)
        .map((c) => `${c.name} ${(s[c.id] ?? 0).toFixed(2)}`)
        .join(" / ");
      if (opts.verbose) {
        console.log(`\n===== Day ${w.day} =====`);
        for (const e of w.events.filter((e) => e.day === w.day && e.kind !== "assess")) {
          const causes = e.causes.length ? ` (<- ${e.causes.map((c) => `#${c}`).join(",")})` : "";
          console.log(`#${e.id}${causes} ${e.text}`);
        }
        for (const p of plans)
          console.log(
            `-- 計画 ${p.faction}: ${p.aims.join(" / ")} (moves ${p.moves.length}, rejected ${p.rejected.length})`,
          );
        console.log(`-- 王の評価: ${kingLine}`);
      }
      console.log(
        `[day ${w.day}] ${((performance.now() - td) / 1000).toFixed(1)}s (plan ${planSec}s, review ${reviewSec}s) jev=${stats.calls - callsBefore} | ${kingLine}`,
      );
    }
    if (until >= w.totalDays) {
      const { heir, probabilities } = await kingDecide(w);
      console.log(`[heir] ${name(heir)} [${fmt(probabilities)}]`);
    }
  } finally {
    saveCache();
    w.meta.finishedAt = new Date().toISOString();
    w.meta.jev = {
      calls: stats.calls - before.calls,
      cacheHits: stats.cacheHits - before.cacheHits,
      retries: stats.retries - before.retries,
      inputTokens: stats.inputTokens - before.inputTokens,
    };
  }
  mkdirSync("out/runs", { recursive: true });
  const suffix = opts.label ? `-${opts.label}` : "";
  const file = `out/runs/${w.meta.startedAt.replace(/[:.]/g, "-")}${suffix}.json`;
  writeFileSync(file, JSON.stringify(w));
  const j = w.meta.jev;
  console.log(
    `[jev] calls=${j.calls} cacheHits=${j.cacheHits} retries=${j.retries} [llm] calls=${llmStats.calls} cacheHits=${llmStats.cacheHits} wall=${((performance.now() - t0) / 1000).toFixed(1)}s -> ${file}`,
  );
  return { world: w, file };
}

/** 王以外の支持の集計。表示用 */
export function supportTally(w: World): Record<string, string[]> {
  const tally: Record<string, string[]> = {};
  for (const [pid, m] of Object.entries(w.minds)) {
    if (pid === KING) continue;
    tally[m.support] ??= [];
    tally[m.support].push(pid);
  }
  return tally;
}
