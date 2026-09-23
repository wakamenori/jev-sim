// ある脅しがなぜ選ばれ、なぜ選択肢にあったかを調べる。  node scripts/why-threat.ts <run.json> <actor> <day>
import { readFileSync } from "node:fs";
import type { World } from "../src/types.ts";

const [file, actor, dayArg] = process.argv.slice(2);
const day = Number(dayArg);
const w = JSON.parse(readFileSync(file, "utf8")) as World;
const ev = w.events.find(
  (e) => e.kind === "act" && e.actor === actor && e.day === day && e.text.includes("threaten:"),
);
if (!ev) throw new Error("threat act not found");
const key = /（(.+?)）/.exec(ev.text)?.[1] ?? "";
console.log(`行動: d${ev.day}t${ev.turn} ${key}`);
const d = (ev.data as { action?: Record<string, number> })?.action ?? {};
console.log(
  `選んだ確率 ${(d[key] ?? 0).toFixed(2)}  上位: ${Object.entries(d)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([k, p]) => `${k}:${p.toFixed(2)}`)
    .join(" ")}`,
);
const plan = w.plans.find((p) => p.day === day && p.moves.some((m) => m.actor === actor && m.action === key));
console.log(
  `参謀の計画にあったか: ${plan ? `あり（${plan.lead}）: ${plan.moves.find((m) => m.actor === actor && m.action === key)?.purpose}` : "なし"}`,
);
const it = w.minds[actor].intention;
console.log(
  `本人の狙いにあったか（最終日の記録のみ残る）: ${it?.day === day && it.moves.some((m) => m.action === key) ? "あり" : "不明"}`,
);
const fact = key.split(":")[2];
const k = w.minds[actor].knowledge.find((x) => x.factId === fact);
console.log(
  `${actor} がこの事実を知った経緯: ${k ? `day ${k.day}、${k.source} から（出所 ${k.via ?? "-"}）` : "知らない"}`,
);
const snap = w.snapshots.find((s) => s.day === day - 1)?.minds[actor];
console.log(
  `前日の終わりに ${actor} が「知っている」と分かっていた人: ${(snap?.knownKnowers?.[fact] ?? []).join(", ") || "なし"}`,
);
console.log(`事実の当事者: ${w.facts[fact].parties.join(", ")}`);
