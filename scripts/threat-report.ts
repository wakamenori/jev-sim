// 実行ログから、脅しの記録・応じ方・実行・暴露・信用をまとめる
import { readFileSync } from "node:fs";
import type { World } from "../src/types.ts";

const w = JSON.parse(readFileSync(process.argv[2], "utf8")) as World;
const tally: Record<string, number> = {};
for (const t of w.threats) tally[t.status] = (tally[t.status] ?? 0) + 1;
console.log("脅しの状態:", JSON.stringify(tally));
const resp: Record<string, number> = {};
for (const e of w.events.filter((x) => x.kind === "threaten")) {
  const r = /、(屈服させた|拒まれた|脅し返された|拒まれ、相手は頭目に助けを求めた)/.exec(e.text)?.[1] ?? "?";
  resp[r] = (resp[r] ?? 0) + 1;
}
console.log("標的の応じ方:", JSON.stringify(resp));
for (const t of w.threats)
  console.log(`  d${t.day} ${t.from} → ${t.to} ${t.fact} 経路=${t.channel} 状態=${t.status}`);
console.log("\n実行・失効・暴露・解放・命令:");
for (const e of w.events.filter((x) =>
  ["carried_out", "lapsed", "exposed", "released", "order"].includes(x.kind),
))
  console.log(`  d${e.day}t${e.turn} ${e.kind.padEnd(11)} ${e.text.slice(0, 100)}`);
console.log(
  "\n信用の記録:",
  JSON.stringify(
    Object.fromEntries(
      Object.entries(w.minds)
        .filter(([, m]) => Object.keys(m.reputations).length)
        .map(([id, m]) => [id, m.reputations]),
    ),
  ),
);
console.log(
  "王に会える人:",
  Object.values(w.people)
    .filter((p) => p.accessToKing)
    .map((p) => p.id)
    .join(", "),
);
