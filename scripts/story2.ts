// 筋の補足: 王への訴えの日ごとの効き、依頼・口止め・目撃の伝達の主なもの、各陣営の計画の狙い
import { readFileSync } from "node:fs";
import type { World } from "../src/types.ts";

const w = JSON.parse(readFileSync(process.argv[2], "utf8")) as World;
const n = (id: string) =>
  w.people[id]?.name.replace(
    /^(Prince|Lady|Sir|Queen|Master|Chancellor|General|Bishop|Guildmaster|Captain|King) /,
    "",
  ) ?? id;
const byDay: Record<number, Record<string, number>> = {};
for (const e of w.events.filter(
  (x) => x.kind === "reassess" && x.actor === "king" && x.text.includes("訴え"),
))
  for (const [c, d] of Object.entries(e.data as Record<string, number>)) {
    byDay[e.day] ??= {};
    byDay[e.day][c] = (byDay[e.day][c] ?? 0) + d;
  }
console.log(
  "王への訴えの効き（日ごと）:",
  Object.entries(byDay)
    .map(
      ([d, o]) =>
        `d${d} ${Object.entries(o)
          .map(([c, v]) => `${n(c)}${v > 0 ? "+" : ""}${v.toFixed(1)}`)
          .join(",")}`,
    )
    .join(" | "),
);
const urgeKing = w.events.filter((e) => e.kind === "act" && e.text.includes("urge:king"));
const who: Record<string, number> = {};
for (const e of urgeKing) who[n(e.actor)] = (who[n(e.actor)] ?? 0) + 1;
console.log("王への訴えをした人:", JSON.stringify(who));
console.log("\n依頼・口止め（成立したもの）:");
for (const e of w.events.filter(
  (x) =>
    (x.kind === "request" && x.text.includes("引き受け")) ||
    (x.kind === "silence" && x.text.includes("約束させた")),
))
  console.log(`  d${e.day} ${e.text.replace(/「[^」]*」/g, "「…」").slice(0, 80)}`);
console.log("\n目撃を伝えた（誰が誰に、誰の訪問を）:");
for (const e of w.events.filter((x) => x.kind === "hear_sighting").slice(0, 14))
  console.log(`  d${e.day} ${e.text.slice(0, 70)}`);
console.log("\n各陣営の計画の最初の狙い:");
for (const p of w.plans.filter((x) => [1, 4, 8, 11].includes(x.day)))
  console.log(`  d${p.day} ${n(p.faction)}: ${p.aims[0]?.slice(0, 90)}`);
console.log(
  "\nCedric の評価が動いた日の王の知識:",
  w.minds.king.knowledge.map((k) => `${k.factId}<${n(k.source)} d${k.day}`).join(", "),
);
