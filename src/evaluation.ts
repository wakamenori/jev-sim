import type { Experimental_EvaluationQuestion } from "ai";
export type Questions = Record<string, Experimental_EvaluationQuestion>;
export type Probabilities = Record<string, number>;
export type Answer =
  | { type: "choice"; choice: string; probabilities: Probabilities }
  | { type: "score"; score: number; probabilities: Probabilities }
  | { type: "boolean"; probability: number };
export type Answers = Record<string, Answer>;
/** 回答を種類ごとに取り出す。種類が違えばバグなので落とす */
export function choice(a: Answer): Probabilities {
  if (a.type !== "choice") throw new Error(`expected choice, got ${a.type}`);
  return a.probabilities;
}
export function score(a: Answer): { score: number; probabilities: Probabilities } {
  if (a.type !== "score") throw new Error(`expected score, got ${a.type}`);
  return a;
}
export function bool(a: Answer): number {
  if (a.type !== "boolean") throw new Error(`expected boolean, got ${a.type}`);
  return a.probability;
}

export type Evaluate = (state: string, questions: Questions) => Promise<Answers>;
