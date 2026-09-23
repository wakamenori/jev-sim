// 介入実行。ベースラインを回し（キャッシュで再現）、指定した判断だけ差し替えて回し直し、差分を出す。
//   pnpm fork --day 3 [--turn 2] --actor lysander --action tell:godfrey:f_courtship [--support cedric]
import { basename } from "node:path";
import { diffRuns } from "./diff.ts";
import { runSim } from "./run.ts";
import type { Override } from "./types.ts";

const arg = (k: string) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const day = Number(arg("--day"));
const actor = arg("--actor");
if (!day || !actor) {
  console.error(
    "usage: pnpm fork --day N --actor ID [--approach ID] [--support ID] [--intent X] [--tell FACT]",
  );
  process.exit(1);
}
const turn = arg("--turn") ? Number(arg("--turn")) : undefined;
const overrides: Override[] = (["action", "support"] as const)
  .map((field) => ({ field, value: arg(`--${field}`) }))
  .filter((o): o is { field: Override["field"]; value: string } => o.value !== undefined)
  .map((o) => ({ day, turn, actor, ...o }));
if (!overrides.length) {
  console.error("介入する項目を 1 つ以上指定してください");
  process.exit(1);
}

console.log("--- base");
const base = await runSim({ label: "base" });
console.log("--- fork", JSON.stringify(overrides));
const fork = await runSim({ overrides, forkOf: basename(base.file), label: "fork" });

const d = diffRuns(base.world, fork.world);
const f = (p?: Record<string, number>) =>
  p
    ? Object.entries(p)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => `${k}:${v.toFixed(2)}`)
        .join(" ")
    : "-";
console.log("\n=== 差分");
console.log(`指名: base ${d.heir.base} [${f(d.heir.baseP)}]  fork ${d.heir.fork} [${f(d.heir.forkP)}]`);
console.log(
  `最初の食い違い: day ${d.firstDivergence?.day}\n  base: ${d.firstDivergence?.base}\n  fork: ${d.firstDivergence?.fork}`,
);
console.log(`内面が食い違った人数: ${d.divergedPeople.map((x) => `d${x.day}:${x.people.length}`).join(" ")}`);
for (const c of d.supportChanges) console.log(`支持の食い違い d${c.day} ${c.id}: ${c.base} -> ${c.fork}`);
console.log(`再計算した Jev 呼び出し: ${fork.world.meta?.jev?.calls}（残りはキャッシュ）`);
