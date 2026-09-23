// 脅しの仕組みの検証。指定した脅しを介入で打たせ、数日回して、脅しの記録・実行・暴露・信用を確かめる。
//   node --env-file=.env scripts/threat-scenario.ts <actor> <action> [days]
import { runSim } from "../src/run.ts";

const [actor = "petra", action = "threaten:hubert:f_skim:court", days = "3"] = process.argv.slice(2);
const { world: w } = await runSim({
  until: Number(days),
  overrides: [{ day: 1, turn: 1, actor, field: "action", value: action }],
  label: "threat",
});
console.log("\n脅しの記録:");
for (const t of w.threats)
  console.log(
    `  d${t.day} ${t.from} → ${t.to} ${t.fact} 経路=${t.channel} 期限=d${t.deadline} 状態=${t.status}`,
  );
console.log("\n脅しと暴露に関わる出来事:");
for (const e of w.events.filter((x) =>
  ["threaten", "carried_out", "lapsed", "exposed", "released", "order", "switch"].includes(x.kind),
))
  console.log(`  d${e.day}t${e.turn} ${e.kind.padEnd(11)} ${e.text.slice(0, 110)}`);
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
