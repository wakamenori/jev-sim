// 説得と脅しの相手と結果の内訳
import { readFileSync } from "node:fs";
import type { World } from "../../src/types.ts";

const w = JSON.parse(readFileSync(process.argv[2], "utf8")) as World;
const tally = (xs: string[]) => {
  const t: Record<string, number> = {};
  for (const x of xs) t[x] = (t[x] ?? 0) + 1;
  return JSON.stringify(Object.fromEntries(Object.entries(t).sort((a, b) => b[1] - a[1])));
};
const logs = Object.entries(w.minds).flatMap(([id, m]) => m.actionLog.map((a) => ({ id, ...a })));
const urges = logs.filter((a) => a.action.startsWith("urge:"));
console.log("説得の相手", tally(urges.map((a) => a.action.split(":")[1])));
console.log(
  "説得の反応",
  tally(
    urges.map((a) =>
      a.outcome.replace(
        /Prince \w+|Lady \w+|Sir \w+|Master \w+|Chancellor \w+|General \w+|Bishop \w+|Guildmaster \w+|Captain \w+|Queen \w+|\w+ (?=was|came)/g,
        "X",
      ),
    ),
  ),
);
const threats = logs.filter((a) => a.action.startsWith("threaten:"));
console.log("脅し", tally(threats.map((a) => `${a.id}→${a.action.split(":")[1]}:${a.action.split(":")[2]}`)));
const kingViews = w.events.filter(
  (e) => e.kind === "reassess" && e.actor === "king" && e.text.includes("訴え"),
);
const sum: Record<string, number> = {};
for (const e of kingViews)
  for (const [c, d] of Object.entries(e.data as Record<string, number>)) sum[c] = (sum[c] ?? 0) + d;
console.log("王への訴えで動いた評価の合計", JSON.stringify(sum));
