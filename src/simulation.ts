import { TURNS } from "./constants.ts";
import type { ChooseAction } from "./decision.ts";
import { createEngine } from "./engine.ts";
import type { Evaluate } from "./evaluation.ts";
import type { Generate } from "./generation.ts";
import { reviewAll } from "./review.ts";
import { planAll } from "./strategy.ts";
import type { World } from "./types.ts";
import { closeDay, startDay } from "./world.ts";

export interface Decisions {
  ask: Evaluate;
  generate: Generate;
  chooseAction?: ChooseAction;
}

export interface Phase {
  name: "planning" | "turn" | "evaluation" | "review" | "succession";
  day: number;
  turn?: number;
}
export type ObservePhase = (phase: Phase, event: "started" | "completed") => void;

/** Runs a fresh world or continues one from a completed day. No I/O or model selection. */
export async function simulate(
  w: World,
  decisions: Decisions,
  until = w.totalDays,
  onDay?: (w: World) => void,
  observe?: ObservePhase,
) {
  if (!Number.isInteger(until) || until < w.day || until > w.totalDays)
    throw new Error(`Invalid final day: ${until}`);
  async function phase<T>(name: Phase["name"], fn: () => Promise<T>) {
    const context: Phase = { name, day: w.day, turn: name === "turn" ? w.turn : undefined };
    observe?.(context, "started");
    const value = await fn();
    observe?.(context, "completed");
    return value;
  }
  const engine = createEngine(decisions.ask, decisions.chooseAction);
  while (w.day < until) {
    startDay(w);
    w.plans.push(...(await phase("planning", () => planAll(decisions.generate, w))));
    for (let turn = 1; turn <= TURNS; turn++) {
      w.turn = turn;
      await phase("turn", () => engine.runTurn(w));
    }
    await phase("evaluation", () => engine.endDay(w));
    await phase("review", () => reviewAll(decisions.generate, w));
    closeDay(w);
    onDay?.(w);
  }
  if (until === w.totalDays && !w.events.some((e) => e.kind === "name_heir"))
    await phase("succession", () => engine.kingDecide(w));
  return w;
}
