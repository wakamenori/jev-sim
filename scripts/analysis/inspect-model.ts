// 個人モデルの各仕組みが働いているかを確かめる
import { readFileSync } from "node:fs";
import type { World } from "../../src/types.ts";

const w = JSON.parse(readFileSync(process.argv[2], "utf8")) as World;

console.log(
  "目撃の数:",
  Object.entries(w.minds)
    .filter(([, m]) => m.sightings.length)
    .map(([id, m]) => `${id} ${m.sightings.length}`)
    .join(", "),
);
console.log("\nLysander の推測（本心との一致）:");
for (const [id, b] of Object.entries(w.minds.lysander.beliefs)) {
  const truth = w.minds[id].support;
  console.log(
    `  ${id.padEnd(8)} 推測 ${String(b.support).padEnd(9)} 本心 ${truth.padEnd(9)} ${b.support === truth ? "○" : "×"}  ${b.note}`,
  );
}
let right = 0;
let total = 0;
for (const [obs, m] of Object.entries(w.minds))
  for (const [id, b] of Object.entries(m.beliefs)) {
    if (obs === id || b.support === "unknown") continue;
    total++;
    if (b.support === w.minds[id].support) right++;
  }
console.log(`\n全員の推測の正答率（unknown を除く）: ${right}/${total}`);
console.log("\n頭目への報告:");
for (const [id, m] of Object.entries(w.minds))
  for (const r of m.reports)
    console.log(
      `  → ${id} day${r.day} from ${r.from}: ${r.lines.length} 行（例: ${r.lines[0]?.slice(0, 80)}）`,
    );
console.log("\n翌日の個人の狙いの例:");
for (const id of ["godfrey", "tam", "hubert", "lysander"]) {
  const it = w.minds[id].intention;
  console.log(
    `  ${id}: ${it?.aims.join(" / ").slice(0, 120)}  手: ${it?.moves.map((x) => x.action).join(", ")}`,
  );
}
const acts = w.events.filter((e) => e.kind === "act" || e.kind === "wait");
console.log(
  `\n行動 ${acts.length}、目撃を伝えた ${acts.filter((e) => e.text.includes("tellseen")).length}、依頼を果たした ${acts.filter((e) => e.text.includes("依頼の実行")).length}`,
);
console.log(
  "支持の変化・脅し:",
  w.events
    .filter((e) => ["switch", "threaten", "released"].includes(e.kind))
    .map((e) => `d${e.day} ${e.text.slice(0, 60)}`)
    .join(" | ") || "なし",
);
