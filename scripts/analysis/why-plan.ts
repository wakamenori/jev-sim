// 参謀がなぜ王への説得を計画し続けるかを見る: 弾かれた一手の中身と、渡した前日の報告
import { readFileSync } from "node:fs";
import type { World } from "../../src/types.ts";

const w = JSON.parse(readFileSync(process.argv[2], "utf8")) as World;
const rej: Record<string, number> = {};
for (const p of w.plans)
  for (const r of p.rejected) rej[r.move.action.split(":")[0]] = (rej[r.move.action.split(":")[0]] ?? 0) + 1;
console.log("弾かれた一手の種類", JSON.stringify(rej));
console.log("弾かれた一手の例:");
for (const p of w.plans.filter((x) => x.day >= 5 && x.day <= 6))
  for (const r of p.rejected)
    console.log(`  d${p.day} ${p.faction} ${r.move.actor} ${r.move.action}  // ${r.move.purpose}`);

// Edmund 陣営の 6 日目の計画と、そのとき参謀に渡った前日（5 日目）の報告
const members = ["edmund", "rowan", "varric", "brand"];
console.log("\n5 日目の Edmund 陣営の行動と反応（6 日目の参謀が受け取る報告）:");
for (const m of members)
  for (const a of w.minds[m].actionLog.filter((x) => x.day === 5))
    console.log(`  ${m} t${a.turn} ${a.action} → ${a.outcome}`);
const p6 = w.plans.find((p) => p.day === 6 && p.faction === "edmund");
console.log(`\n6 日目の Edmund 陣営の計画: ${p6?.assessment}\n  aims: ${p6?.aims.join(" | ")}`);
for (const m of p6?.moves ?? []) console.log(`  ✓ ${m.actor} ${m.action} // ${m.purpose}`);
for (const r of p6?.rejected ?? []) console.log(`  ✗ ${r.move.actor} ${r.move.action} (${r.reason})`);
