// 王への説得がなぜ多いのかを、ログから切り分ける
import { readFileSync } from "node:fs";
import type { World } from "../../src/types.ts";

const w = JSON.parse(readFileSync(process.argv[2], "utf8")) as World;
const acts = w.events.filter((e) => e.kind === "act" || e.kind === "wait");
const keyOf = (text: string) => /（(.+?)）/.exec(text)?.[1] ?? "wait";
const urges = acts.filter((e) => keyOf(e.text) === "urge:king");

// 4. 誰が
const who: Record<string, number> = {};
for (const e of urges) who[e.actor] = (who[e.actor] ?? 0) + 1;
console.log("4. 王に説得した人", JSON.stringify(who));

// 1. 計画に入っていたか
const planned = new Set(w.plans.flatMap((p) => p.moves.map((m) => `${m.day}|${m.actor}|${m.action}`)));
const inPlan = urges.filter((e) => planned.has(`${e.day}|${e.actor}|urge:king`)).length;
const planUrgeKing = w.plans.flatMap((p) => p.moves).filter((m) => m.action === "urge:king").length;
const planAll = w.plans.flatMap((p) => p.moves).length;
console.log(
  `1. 計画にあった王への説得 ${planUrgeKing}/${planAll} 手。実際の王への説得のうち計画どおり ${inPlan}/${urges.length}`,
);

// 2. 見えた反応
const outcomes: Record<string, number> = {};
for (const m of Object.values(w.minds))
  for (const a of m.actionLog.filter((x) => x.action === "urge:king"))
    outcomes[a.outcome] = (outcomes[a.outcome] ?? 0) + 1;
console.log("2. 王への説得で見えた反応", JSON.stringify(outcomes));

// 3. 選んだときの確率と、次点
let sumP = 0;
const second: Record<string, number> = {};
for (const e of urges) {
  const d = ((e.data as { action?: Record<string, number> })?.action ?? {}) as Record<string, number>;
  sumP += d["urge:king"] ?? 0;
  const [, s] = Object.entries(d).sort((a, b) => b[1] - a[1]);
  if (s) second[s[0].split(":")[0]] = (second[s[0].split(":")[0]] ?? 0) + 1;
}
console.log(
  `3. 王への説得を選んだときの確率 平均 ${(sumP / urges.length).toFixed(2)}  次点の種類 ${JSON.stringify(second)}`,
);

// 日ごとの推移（記録が効いて減っていくか）
const perDay: number[] = [];
for (const e of urges) perDay[e.day] = (perDay[e.day] ?? 0) + 1;
console.log("   日ごとの王への説得", perDay.slice(1).join(" "));

// 同じ人の state に、記録がどう書かれていたかの例: Edmund の最終日の記録
const ed = w.minds.edmund.actionLog.filter((a) => a.action === "urge:king");
console.log(
  `   Edmund の王への説得 ${ed.length} 回。反応の並び: ${ed.map((a) => (a.outcome.includes("seemed moved") ? "○" : "×")).join("")}`,
);
