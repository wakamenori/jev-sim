// 土台の点検。「選択が変われば結果が変わりうるか」を、鎖の各段で数字にする。
//   pnpm checks            てこの実験（Jev を呼ぶ。キャッシュあり）＋最新の実行ログの指標
//   pnpm checks --log-only 最新ログの指標だけ
import { readdirSync, readFileSync } from "node:fs";
import { KING } from "../../src/cast.ts";
import { describe, trustWord, viewWord } from "../../src/describe.ts";
import { choice } from "../../src/evaluation.ts";
import { candidates } from "../../src/rules.ts";
import type { Id, World } from "../../src/types.ts";
import { buildWorld } from "../../src/world.ts";
import { ask } from "../models.ts";

const fmt = (o: Record<string, number>) =>
  Object.entries(o)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k}:${v.toFixed(2)}`)
    .join(" ");
const mark = (ok: boolean) => (ok ? "✓" : "✗");

/** day 1 の初期世界で、listener が信頼する from から事実を聞いた状態を作る */
function withFact(listener: Id, factId: Id, from: Id): World {
  const w = buildWorld();
  w.day = 1;
  const m = w.minds[listener];
  m.trust[from] = 4;
  m.knowledge.push({ factId, belief: 0.9, source: from, day: 1 });
  m.testimony.push({ day: 1, from, kind: "claim", about: factId, eventId: 0 });
  return w;
}

async function heirIfToday(w: World) {
  const a = await ask(describe(w, KING), {
    heir: {
      type: "choice",
      instructions: "If the King had to name his heir today, whom would he name?",
      criteria: Object.fromEntries(candidates(w).map((c) => [c.id, c.name])),
    },
  });
  return choice(a.heir);
}

async function supportOf(w: World, pid: Id) {
  const c: Record<string, string> = Object.fromEntries(candidates(w).map((x) => [x.id, x.name]));
  c.undecided = "Commit to nobody yet";
  const a = await ask(describe(w, pid), {
    support: {
      type: "choice",
      instructions: `Given everything ${w.people[pid].name} knows and wants, which candidate do they now genuinely favor for the throne?`,
      criteria: c,
    },
  });
  return choice(a.support);
}

async function leverage() {
  console.log("## 1. 王のてこ: 最も信頼する侍従から秘密を 1 つ聞いたら、今日の指名はどう動くか");
  const base = await heirIfToday(buildWorld());
  const top = Math.max(...Object.values(base));
  console.log(`${mark(top < 0.6)} 初期状態の指名 [${fmt(base)}]（最有力が 0.6 未満なら接戦）`);
  // 事実 → 不利になるはずの候補
  const hits: [Id, Id][] = [
    ["f_debt", "edmund"],
    ["f_courtship", "cedric"],
    ["f_letters", "theodric"],
    ["f_bribe", "theodric"],
  ];
  const rs = await Promise.all(
    hits.map(async ([f, c]) => [f, c, await heirIfToday(withFact(KING, f, "godfrey"))] as const),
  );
  for (const [f, c, r] of rs) {
    const d = (r[c] ?? 0) - (base[c] ?? 0);
    console.log(`${mark(d <= -0.15)} ${f.padEnd(12)} ${c} ${d >= 0 ? "+" : ""}${d.toFixed(2)}  [${fmt(r)}]`);
  }

  console.log("\n## 2. 忠誠のてこ: 自陣営の候補に不利な事実を、信頼する人から聞いたら支持はどう動くか");
  // expect: その人物の利害から見て、支持が動くべき（move）か動かないべき（hold）か
  const cases: { pid: Id; fact: Id; from: Id; own: Id; expect: "move" | "hold"; why: string }[] = [
    {
      pid: "anselm",
      fact: "f_courtship",
      from: "lysander",
      own: "cedric",
      expect: "move",
      why: "教会の祝福のない婚約は司教にとって致命的",
    },
    {
      pid: "brand",
      fact: "f_debt",
      from: "rowan",
      own: "edmund",
      expect: "hold",
      why: "Rowan への恩義で動く",
    },
    {
      pid: "varric",
      fact: "f_debt",
      from: "rowan",
      own: "edmund",
      expect: "hold",
      why: "兵士の王を望む。借金は問題にしない",
    },
    {
      pid: "hubert",
      fact: "f_courtship",
      from: "lysander",
      own: "cedric",
      expect: "hold",
      why: "扱いやすい王なら醜聞は気にしない",
    },
    {
      pid: "orlin",
      fact: "f_letters",
      from: "isolde",
      own: "theodric",
      expect: "hold",
      why: "金で動く。勝ち馬に乗る",
    },
    {
      pid: "petra",
      fact: "f_letters",
      from: "isolde",
      own: "theodric",
      expect: "hold",
      why: "Varenne との通商を望む",
    },
  ];
  const ls = await Promise.all(
    cases.map(async (c) => ({
      ...c,
      before: await supportOf(buildWorld(), c.pid),
      after: await supportOf(withFact(c.pid, c.fact, c.from), c.pid),
    })),
  );
  for (const c of ls) {
    const d = (c.after[c.own] ?? 0) - (c.before[c.own] ?? 0);
    const moved = d <= -0.2;
    console.log(
      `${mark(c.expect === "move" ? moved : !moved)} ${c.pid.padEnd(7)} ${c.fact.padEnd(12)} ${c.expect} ${c.own} ${d >= 0 ? "+" : ""}${d.toFixed(2)}  [${fmt(c.after)}]  ${c.why}`,
    );
  }
}

function logMetrics(file: string) {
  const w = JSON.parse(readFileSync(file, "utf8")) as World;
  console.log(`\n## 3〜5. 実行ログの指標  ${file}`);
  const s0 = w.snapshots[0].minds;
  const sN = w.snapshots.at(-1)?.minds ?? w.minds;
  let op = 0;
  let opVis = 0;
  let tr = 0;
  let trVis = 0;
  for (const id of Object.keys(sN)) {
    for (const [c, b] of Object.entries(sN[id].opinions ?? {})) {
      const a = s0[id].opinions?.[c];
      // 0.25 未満の変化は Jev の答えが「ほぼ変化なし」だったもの。届かなくてよい
      if (a === undefined || Math.abs(a - b) < 0.25) continue;
      op++;
      if (viewWord(a) !== viewWord(b)) opVis++;
    }
    for (const [o, b] of Object.entries(sN[id].trust)) {
      const a = s0[id].trust[o];
      if (Math.abs(a - b) < 0.25) continue;
      tr++;
      if (trustWord(a) !== trustWord(b)) trVis++;
    }
  }
  const rate = (a: number, b: number) => (b ? `${a}/${b} (${((a / b) * 100).toFixed(0)}%)` : "0/0");
  console.log(`3. 0.25 以上の変化が Jev に届いた割合  候補評価 ${rate(opVis, op)}  信頼 ${rate(trVis, tr)}`);
  const kingFacts = w.minds[KING].knowledge.filter((k) => k.source !== "self").length;
  console.log(
    `4. 王に届いた事実 ${kingFacts} 件  王が受けた説得 ${w.minds[KING].testimony.filter((t) => t.kind === "urge").length} 件`,
  );
  const acts = w.events.filter((e) => e.kind === "act" || e.kind === "wait");
  const effects = new Set(w.events.flatMap((e) => e.causes));
  const kinds = (k: string) => w.events.filter((e) => e.kind === k);
  const outcome = (k: string, ok: RegExp) =>
    `${kinds(k).filter((e) => ok.test(e.text)).length}/${kinds(k).length}`;
  console.log(
    `5. 行動 ${acts.length}  うち何も起きなかった ${acts.filter((m) => !effects.has(m.id)).length}  事実の伝達 ${kinds("hear").length}  評価の変化 ${kinds("reassess").length}  支持の変化 ${kinds("switch").length}`,
  );
  console.log(
    `   依頼 引き受け ${outcome("request", /引き受けられた/)}  脅し 屈服 ${outcome("threaten", /屈服/)}  口止め 約束 ${outcome("silence", /約束させた/)}  告発 ${kinds("accuse").length}`,
  );
  const planned = new Set(w.plans.flatMap((p) => p.moves.map((m) => `${m.day}|${m.actor}|${m.action}`)));
  const taken = acts.filter((e) =>
    planned.has(`${e.day}|${e.actor}|${/（(.+?)）/.exec(e.text)?.[1]}`),
  ).length;
  const rejected = w.plans.reduce((n, p) => n + p.rejected.length, 0);
  const moves = w.plans.reduce((n, p) => n + p.moves.length, 0);
  console.log(
    `6. 参謀の計画  採用された一手 ${moves}  弾かれた一手 ${rejected}  計画どおりの行動 ${taken}/${acts.length}`,
  );
  const ks = w.kingSuitability;
  console.log(`   王の評価 day1 ${JSON.stringify(ks[0])} → day${ks.length} ${JSON.stringify(ks.at(-1))}`);
  const heir = [...w.events].reverse().find((e) => e.kind === "name_heir");
  console.log(`   指名 ${heir?.text ?? "（指名前に停止）"}`);
}

if (!process.argv.includes("--log-only")) await leverage();
const runs = readdirSync("out/runs")
  .filter((f) => f.endsWith(".json") && !f.includes("-fork"))
  .sort();
const latest = runs.at(-1);
if (latest) logMetrics(`out/runs/${latest}`);
