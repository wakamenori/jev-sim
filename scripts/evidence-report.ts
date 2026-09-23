// 実行ログから、証拠・告発・暴露・脅しの流れをまとめる
import { readFileSync } from "node:fs";
import type { World } from "../src/types.ts";

const w = JSON.parse(readFileSync(process.argv[2], "utf8")) as World;
console.log(
  "証拠の最終的な持ち主:",
  Object.values(w.evidence)
    .map((e) => `${e.id}=${e.holder ?? "処分"}`)
    .join(", "),
);
for (const a of w.events.filter((e) => e.kind === "accuse")) {
  const hs = w.events.filter((e) => e.kind === "hear" && e.causes.includes(a.id));
  const b = hs.filter((h) => (h.data as { belief: number }).belief >= 0.5).length;
  const proof = Object.values(w.evidence).some((e) => e.fact === a.factId) ? "" : "（証拠なしの事実）";
  console.log(`告発 d${a.day}t${a.turn} ${a.actor} ${a.factId}${proof}: 信じた ${b}/${hs.length}`);
}
const kinds = [
  "exposed",
  "evidence_moved",
  "evidence_destroyed",
  "threaten",
  "carried_out",
  "lapsed",
  "released",
  "order",
  "switch",
];
for (const e of w.events.filter((x) => kinds.includes(x.kind)))
  console.log(
    `d${e.day}t${e.turn} ${e.kind.padEnd(18)} ${e.text.replace(/「[^」]{40,}」/g, (m) => `${m.slice(0, 30)}…」`).slice(0, 120)}`,
  );
console.log(
  "王に会える人:",
  Object.values(w.people)
    .filter((p) => p.accessToKing)
    .map((p) => p.id)
    .join(", "),
);
