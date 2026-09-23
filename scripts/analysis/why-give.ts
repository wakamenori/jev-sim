// 陣営をまたぐ証拠の受け渡しを調べる: 計画か本人か、目的、確率、立場、その後の使われ方
import { readFileSync } from "node:fs";
import type { World } from "../../src/types.ts";

const w = JSON.parse(readFileSync(process.argv[2], "utf8")) as World;
const snap = (d: number) => w.snapshots.find((s) => s.day === d)?.minds ?? {};
for (const e of w.events.filter((x) => x.kind === "act" && x.text.includes("give:"))) {
  const key = /（(.+?)）/.exec(e.text)?.[1] ?? "";
  const [, to, eid] = key.split(":");
  const d = (e.data as { action?: Record<string, number> })?.action ?? {};
  const top = Object.entries(d)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, p]) => `${k}:${p.toFixed(2)}`)
    .join(" ");
  const plan = w.plans.find(
    (p) => p.day === e.day && p.moves.some((m) => m.actor === e.actor && m.action === key),
  );
  const s = snap(e.day - 1);
  const fact = w.evidence[eid]?.fact ?? "";
  console.log(`\n== d${e.day}t${e.turn} ${e.actor} → ${to}: ${eid}（${fact}）`);
  console.log(
    `   立場: ${e.actor}=${s[e.actor]?.support}(${s[e.actor]?.allegiance}) ${to}=${s[to]?.support}(${s[to]?.allegiance})  ${to} は王に${w.people[to].accessToKing ? "会える" : "会えない"}`,
  );
  console.log(
    `   困る人: ${w.facts[fact]?.harms.join(", ")}  選んだ確率 ${(d[key] ?? 0).toFixed(2)}  上位 ${top}`,
  );
  console.log(
    `   参謀の計画: ${plan ? `${plan.lead}: ${plan.moves.find((m) => m.actor === e.actor && m.action === key)?.purpose}` : "なし"}`,
  );
  // その後: 受け取った人がその事実を王や宮廷に伝えたか、暴露が起きたか
  const later = w.events.filter(
    (x) =>
      x.id > e.id &&
      ((x.kind === "hear" && x.target === to && x.factId === fact) ||
        (x.kind === "exposed" && x.factId === fact) ||
        (x.kind === "accuse" && x.actor === to && x.factId === fact)),
  );
  for (const x of later.slice(0, 4))
    console.log(`   その後: d${x.day}t${x.turn} ${x.kind} ${x.text.slice(0, 90)}`);
  if (!later.length) console.log("   その後: 使われていない");
}
