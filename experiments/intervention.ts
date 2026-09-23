import { parseAction } from "../src/actions.ts";
import { KING } from "../src/cast.ts";
import { TURNS } from "../src/constants.ts";
import type { ChooseAction } from "../src/decision.ts";
import type { World } from "../src/types.ts";

export interface Intervention {
  day: number;
  turn: number;
  actor: string;
  field: "action" | "support";
  value: string;
}

/** Change one decision point, including its action reselection after a support change. */
export function intervene(base: ChooseAction, interventions: Intervention[]): ChooseAction {
  return async (w, pid, askSupport) => {
    validateInterventions(w, interventions);
    const selected = await base(w, pid, askSupport);
    const changes = interventions.filter((i) => i.day === w.day && i.turn === w.turn && i.actor === pid);
    const result = { ...selected };
    for (const change of changes) {
      if (change.field === "action") result.action = change.value;
      else if (askSupport) result.support = change.value;
    }
    return result;
  };
}

export function validateInterventions(w: World, interventions: Intervention[], until = w.totalDays) {
  const keys = new Set<string>();
  for (const i of interventions) {
    const key = `${i.day}:${i.turn}:${i.actor}:${i.field}`;
    if (keys.has(key)) throw new Error(`Duplicate intervention: ${key}`);
    keys.add(key);
    if (
      !w.people[i.actor] ||
      i.actor === KING ||
      !Number.isInteger(i.day) ||
      i.day < 1 ||
      i.day > until ||
      !Number.isInteger(i.turn) ||
      i.turn < 1 ||
      i.turn > TURNS
    )
      throw new Error("Invalid intervention target or time");
    if (i.field === "support" && i.value !== "undecided" && !w.people[i.value]?.candidate)
      throw new Error("Invalid support target");
    if (i.field === "action") {
      const action = parseAction(i.value);
      for (const id of [action.target, action.visitor, action.host])
        if (id && !w.people[id]) throw new Error(`Unknown person: ${id}`);
      if (action.fact && !w.facts[action.fact]) throw new Error(`Unknown fact: ${action.fact}`);
      if (action.evidence && !w.evidence[action.evidence])
        throw new Error(`Unknown evidence: ${action.evidence}`);
      if (action.channel && action.channel !== "court" && !w.people[action.channel])
        throw new Error(`Unknown channel: ${action.channel}`);
    }
  }
}
