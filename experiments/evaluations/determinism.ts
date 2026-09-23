import { experimental_evaluate as evaluate } from "ai";

const state = `You are Mara, a baker in a small walled town. You are cautious and value your reputation.
Known people: Tomas (blacksmith, your friend), Ilse (innkeeper, you dislike her), Renn (guard captain, neutral).
It is morning. Your bread stock is low. This morning you overheard Ilse telling a customer that your bread made someone sick.`;
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
  angry: { type: "boolean", instructions: "Is Mara angry right now?" },
} as const;
const rs = await Promise.all(
  Array.from({ length: 5 }, () => evaluate({ model: "typesafe-ai/jev", state, questions })),
);
for (const r of rs) {
  const p: Record<string, number> = r.answers.action.probabilities ?? {};
  console.log(
    r.answers.action.choice,
    Object.keys(p)
      .sort()
      .map((k) => `${k}:${p[k].toFixed(3)}`)
      .join(" "),
    "angry",
    r.answers.angry.probability.toFixed(3),
  );
}
