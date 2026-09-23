// 実行ログから、結末に効いた出来事（王の評価の推移・王に届いた事実・告発・脅し・支持の変化）を拾う
import { readFileSync } from "node:fs";
import type { World } from "../../src/types.ts";

const w = JSON.parse(readFileSync(process.argv[2], "utf8")) as World;
const short = (t: string) => t.replace(/「[^」]{30,}」/g, (m) => `${m.slice(0, 28)}…」`);
console.log(
  "王の評価:",
  w.kingSuitability
    .map((s, i) => `d${i + 1} E${s.edmund.toFixed(1)} C${s.cedric.toFixed(1)} T${s.theodric.toFixed(1)}`)
    .join(" | "),
);
const pick = w.events.filter(
  (e) =>
    (e.kind === "hear" && e.actor === "king") ||
    e.kind === "accuse" ||
    e.kind === "threaten" ||
    e.kind === "switch" ||
    (e.kind === "reassess" && e.actor === "king" && !e.text.includes("訴え")),
);
for (const e of pick) console.log(`d${e.day}t${e.turn} ${e.kind.padEnd(8)} ${short(e.text).slice(0, 110)}`);
const urgeKing: Record<string, number> = {};
for (const e of w.events.filter((x) => x.kind === "reassess" && x.text.includes("訴え")))
  for (const [c, d] of Object.entries(e.data as Record<string, number>)) urgeKing[c] = (urgeKing[c] ?? 0) + d;
console.log("王への訴えで動いた評価の合計", JSON.stringify(urgeKing));
