// 失敗し続ける行動（同じ相手への説得・脅し）がなぜ繰り返されるかを切り分ける。
//   1. 参謀の計画どおりか
//   2. そのとき本人の state に「前回失敗した」と書かれていたか
//   3. 選んだときの確率と、次点
//   4. 計画どおりのとき、参謀は前日の失敗を見ていたか（前日の報告に同じ手の失敗があったか）
import { readFileSync } from "node:fs";
import type { World } from "../../src/types.ts";

const w = JSON.parse(readFileSync(process.argv[2], "utf8")) as World;
const failed = (o: string) => /not swayed|refused|no sign|displeased|revealed nothing/.test(o);
const planned = new Set(w.plans.flatMap((p) => p.moves.map((m) => `${m.day}|${m.actor}|${m.action}`)));
const acts = w.events.filter((e) => e.kind === "act");
const keyOf = (text: string) => /（(.+?)）/.exec(text)?.[1] ?? "";

for (const prefix of ["urge:godfrey", "urge:hubert", "threaten:hubert", "urge:king"]) {
  let n = 0;
  let inPlan = 0;
  let knewFailed = 0;
  let plannerSawFail = 0;
  let pSum = 0;
  const second: Record<string, number> = {};
  for (const e of acts.filter((x) => keyOf(x.text).startsWith(prefix))) {
    const key = keyOf(e.text);
    n++;
    const isPlanned = planned.has(`${e.day}|${e.actor}|${key}`);
    if (isPlanned) inPlan++;
    // このターンより前の、同じ手の最後の結果
    const before = w.minds[e.actor].actionLog.filter(
      (a) => a.action === key && (a.day < e.day || (a.day === e.day && a.turn < (e.turn ?? 0))),
    );
    if (before.length && failed(before[before.length - 1].outcome)) knewFailed++;
    // 参謀の前日の報告に、陣営の誰かの同じ手の失敗があったか
    const faction = w.minds[e.actor].support;
    const members = Object.keys(w.minds).filter((m) => w.minds[m].support === faction);
    const yday = members.flatMap((m) =>
      w.minds[m].actionLog.filter((a) => a.day === e.day - 1 && a.action === key),
    );
    if (isPlanned && yday.some((a) => failed(a.outcome))) plannerSawFail++;
    const d = (e.data as { action?: Record<string, number> })?.action ?? {};
    pSum += d[key] ?? 0;
    const s = Object.entries(d)
      .sort((a, b) => b[1] - a[1])
      .find(([k]) => k !== key);
    if (s) second[s[0].split(":")[0]] = (second[s[0].split(":")[0]] ?? 0) + 1;
  }
  if (!n) continue;
  console.log(
    `${prefix.padEnd(16)} 回数 ${n}  計画どおり ${inPlan}  本人が前回の失敗を知っていた ${knewFailed}  参謀が前日の失敗を見たうえで計画 ${plannerSawFail}  選んだ確率 平均 ${(pSum / n).toFixed(2)}  次点 ${JSON.stringify(second)}`,
  );
}
