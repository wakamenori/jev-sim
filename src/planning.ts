import { z } from "zod";
import { KINDS, parseAction } from "./actions.ts";
import { isOurSecret } from "./rules.ts";
import type { Id, World } from "./types.ts";

/** Shared structured action format for faction plans and personal intentions. */
export function moveSchema(w: World) {
  const ids = ["none", ...Object.keys(w.people)];
  return z.object({
    kind: z.enum(KINDS),
    target: z.enum(ids).describe('the person approached; "none" for accuse'),
    fact: z
      .enum(["none", ...Object.keys(w.facts)])
      .describe('the fact used; "none" for urge, probe and tellseen'),
    visitor: z.enum(ids).describe('for tellseen: who was visiting; otherwise "none"'),
    host: z.enum(ids).describe('for tellseen: whom they visited; otherwise "none"'),
    channel: z
      .enum(["none", "king", "court", ...Object.keys(w.people)])
      .describe('for threaten: how you would expose it; otherwise "none"'),
    evidence: z
      .enum(["none", ...Object.keys(w.evidence)])
      .describe('for give, destroy and extort: the evidence; otherwise "none"'),
    purpose: z.string().describe("one short sentence"),
  });
}

/** A leader cannot order someone to destroy evidence or surrender their own side's secrets. */
export function notOrderable(w: World, actor: Id, key: string): string | undefined {
  const action = parseAction(key);
  if (action.kind === "destroy") return "only the holder can decide to destroy evidence";
  if (action.kind === "give" && action.evidence) {
    const evidence = w.evidence[action.evidence];
    if (evidence && isOurSecret(w, actor, evidence.fact))
      return "only the holder can decide to hand over evidence that hurts your own side";
  }
  return undefined;
}
