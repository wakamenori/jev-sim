// 参謀の計画を 1 件、そのまま表示する。  node scripts/show-plan.ts <run.json> <day> <faction>
import { readFileSync } from "node:fs";
import type { World } from "../src/types.ts";

const [file, day, faction] = process.argv.slice(2);
const w = JSON.parse(readFileSync(file, "utf8")) as World;
const p = w.plans.find((x) => x.day === Number(day) && x.faction === faction);
console.log(JSON.stringify(p, null, 2));
// その日、計画された手が実際にどうなったか
const done = new Map<string, string>();
for (const [id, m] of Object.entries(w.minds))
  for (const a of m.actionLog.filter((x) => x.day === Number(day)))
    done.set(`${id}|${a.action}`, `t${a.turn}: ${a.outcome}`);
console.log("\n実行結果:");
for (const m of p?.moves ?? [])
  console.log(`  ${m.actor} ${m.action} → ${done.get(`${m.actor}|${m.action}`) ?? "実行されなかった"}`);
