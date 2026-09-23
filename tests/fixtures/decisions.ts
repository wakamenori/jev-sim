import type { Answers, Evaluate } from "../../src/evaluation.ts";
import type { Generate } from "../../src/generation.ts";
import { simulate } from "../../src/simulation.ts";
import type { World } from "../../src/types.ts";
import { buildWorld } from "../../src/world.ts";

/** Predictable responses without model calls, disk caches or environment variables. */
export function evaluator(w: World, choiceKeys: Record<string, string> = {}, belief = 0.9): Evaluate {
  return async (state, questions) => {
    const person = Object.values(w.people).find((p) => state.startsWith(`You are ${p.name},`));
    const answers: Answers = {};
    for (const [key, question] of Object.entries(questions)) {
      if (question.type === "boolean") answers[key] = { type: "boolean", probability: belief };
      else if (question.type === "score")
        answers[key] = { type: "score", score: 2, probabilities: { "2": 1 } };
      else {
        const available = Object.keys(question.criteria);
        const defaults: Record<string, string> = {
          action: "wait",
          support: person ? w.minds[person.id].support : "undecided",
          tell: "none",
          respond: "refuse",
        };
        const selected = choiceKeys[key] ?? defaults[key] ?? available[0];
        if (!available.includes(selected))
          throw new Error(`Fixture selected unavailable ${key}: ${selected}`);
        answers[key] = { type: "choice", choice: selected, probabilities: { [selected]: 1 } };
      }
    }
    return answers;
  };
}

export const generate: Generate = async (args) =>
  args.schema.parse(
    args.system.startsWith("You are the private strategic mind")
      ? { assessment: "Hold position", aims: ["Observe"], moves: [] }
      : {
          beliefs: [],
          reportThreats: false,
          reportRivalApproaches: false,
          shareEvidence: [],
          aims: ["Observe"],
          moves: [],
        },
  );

export async function fixtureWorld() {
  const w = buildWorld();
  w.totalDays = 2;
  const ask = evaluator(w);
  await simulate(w, {
    ask,
    generate,
    chooseAction: async (world, actor) => ({
      actor,
      action: actor === "petra" && world.day === 1 && world.turn === 1 ? "tell:godfrey:f_debt" : "wait",
      raw: {},
    }),
  });
  return w;
}
