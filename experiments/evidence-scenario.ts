// 証拠の検証。指定した行動を 1 日目の最初に打たせ、数日回して、告発の信じられ方・暴露・証拠の移動を確かめる。
//   node --env-file=.env experiments/evidence-scenario.ts <actor> <action> [days]
import { runExperiment } from "./run.ts";

const [actor = "petra", action = "accuse:f_skim", days = "2"] = process.argv.slice(2);
const { world: w } = await runExperiment(
  {
    until: Number(days),
    label: "evidence",
  },
  [{ day: 1, turn: 1, actor, field: "action", value: action }],
);
for (const a of w.events.filter((e) => e.kind === "accuse")) {
  const hs = w.events.filter((e) => e.kind === "hear" && e.causes.includes(a.id));
  const b = hs.filter((h) => (h.data as { belief: number }).belief >= 0.5).length;
  console.log(`d${a.day}t${a.turn} 告発 ${a.actor} ${a.factId}: 信じた ${b}/${hs.length}`);
}
for (const e of w.events.filter((x) =>
  ["exposed", "evidence_moved", "evidence_destroyed", "released", "threaten", "carried_out"].includes(x.kind),
))
  console.log(`d${e.day}t${e.turn} ${e.kind.padEnd(18)} ${e.text.slice(0, 110)}`);
console.log(
  "証拠の持ち主:",
  Object.values(w.evidence)
    .map((e) => `${e.id}=${e.holder ?? "処分"}`)
    .join(", "),
);
console.log(
  "王に会える人:",
  Object.values(w.people)
    .filter((p) => p.accessToKing)
    .map((p) => p.id)
    .join(", "),
);
