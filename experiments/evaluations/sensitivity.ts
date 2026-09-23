// 感度検証: 市民1人の state を1文だけ変えたとき、行動分布と関係スコアがどれだけ動くか。
// また同一 state を2回投げて出力が一致するか（決定性）も確認する。
import { experimental_evaluate as evaluate } from "ai";

const base = `You are Mara, a baker in a small walled town. You are cautious and value your reputation.
Known people: Tomas (blacksmith, your friend), Ilse (innkeeper, you dislike her), Renn (guard captain, neutral).
It is morning. Your bread stock is low. Yesterday nothing unusual happened.`;

const variants: Record<string, string> = {
  baseline: base,
  rumor: `${base}\nThis morning you overheard Ilse telling a customer that your bread made someone sick.`,
  letter: `${base}\nThis morning you found an unsigned letter under your door saying Tomas owes Ilse money.`,
  weather: `${base}\nIt is raining heavily this morning.`,
};

const questions = {
  action: {
    type: "choice",
    instructions: "What does Mara do this morning?",
    criteria: {
      bake: "Stay in and bake bread",
      market: "Go to the market square to sell and talk",
      visit_tomas: "Go visit Tomas at the forge",
      confront_ilse: "Go to the inn and confront Ilse",
      report_guard: "Go find Renn and report something",
      stay_home: "Close the shop and stay home",
    },
  },
  trust_tomas: {
    type: "score",
    instructions: "How much does Mara trust Tomas right now?",
    criteria: ["distrust", "wary", "neutral", "trusting", "fully trusting"],
  },
  trust_ilse: {
    type: "score",
    instructions: "How much does Mara trust Ilse right now?",
    criteria: ["distrust", "wary", "neutral", "trusting", "fully trusting"],
  },
  angry: { type: "boolean", instructions: "Is Mara angry right now?" },
} as const;

const fmt = (p: Record<string, number> | undefined) =>
  p
    ? Object.entries(p)
        .map(([k, v]) => `${k}:${v.toFixed(2)}`)
        .join(" ")
    : "-";

for (const [name, state] of Object.entries(variants)) {
  const runs = await Promise.all(
    [1, 2].map(async () => {
      const t0 = performance.now();
      const r = await evaluate({ model: "typesafe-ai/jev", state, questions });
      return { ms: Math.round(performance.now() - t0), r };
    }),
  );
  const same = JSON.stringify(runs[0].r.answers) === JSON.stringify(runs[1].r.answers);
  const a = runs[0].r.answers;
  console.log(
    `\n== ${name}  (${runs[0].ms}ms / ${runs[1].ms}ms, tokens=${runs[0].r.usage.inputTokens}, deterministic=${same})`,
  );
  console.log(`action      : ${a.action.choice}  [${fmt(a.action.probabilities)}]`);
  console.log(`trust_tomas : ${a.trust_tomas.score.toFixed(2)}  [${fmt(a.trust_tomas.probabilities)}]`);
  console.log(`trust_ilse  : ${a.trust_ilse.score.toFixed(2)}  [${fmt(a.trust_ilse.probabilities)}]`);
  console.log(`angry       : ${a.angry.probability.toFixed(2)}`);
}
