import assert from "node:assert/strict";
import { test } from "node:test";
import { diffRuns } from "../experiments/diff.ts";
import { intervene, validateInterventions } from "../experiments/intervention.ts";
import type { ChooseAction } from "../src/decision.ts";
import { createEngine } from "../src/engine.ts";
import { buildWorld } from "../src/world.ts";
import { evaluator, fixtureWorld } from "./fixtures/decisions.ts";

test("interventions replace exactly one decision point and preserve reselection", async () => {
  const w = buildWorld();
  w.day = 1;
  w.turn = 2;
  const base: ChooseAction = async (_w, actor) => ({ actor, action: "wait", raw: {} });
  const select = intervene(base, [
    { day: 1, turn: 2, actor: "anselm", field: "support", value: "theodric" },
    { day: 1, turn: 2, actor: "anselm", field: "action", value: "probe:godfrey" },
  ]);
  await createEngine(evaluator(w), select).runTurn(w);
  assert.equal(w.minds.anselm.support, "theodric");
  assert.equal(w.minds.anselm.actionLog.at(-1)?.action, "probe:godfrey");
  w.turn = 3;
  assert.deepEqual(await select(w, "anselm", true), await base(w, "anselm", true));
});

test("invalid experiment targets and duplicate overrides fail", () => {
  const w = buildWorld();
  const i = { day: 1, turn: 1, actor: "anselm", field: "support" as const, value: "theodric" };
  assert.throws(() => validateInterventions(w, [{ ...i, actor: "missing" }]));
  assert.throws(() => validateInterventions(w, [{ ...i, day: 3 }], 2));
  assert.throws(() => validateInterventions(w, [i, i]));
});

test("run comparison reports unchanged runs and changed support", async () => {
  const base = await fixtureWorld();
  const fork = structuredClone(base);
  assert.equal(diffRuns(base, fork).firstDivergence, undefined);
  assert.ok(diffRuns(base, fork).divergedPeople.every((d) => d.people.length === 0));
  fork.snapshots[1].minds.anselm.support = "theodric";
  assert.deepEqual(diffRuns(base, fork).supportChanges, [
    { day: 1, id: "anselm", base: "cedric", fork: "theodric" },
  ]);
});

test("run comparison includes beliefs, allegiance and turn timing", async () => {
  const base = await fixtureWorld();
  const fork = structuredClone(base);
  fork.snapshots[1].minds.anselm.allegiance = "coerced";
  fork.snapshots[1].minds.lysander.beliefs = { petra: { support: "cedric", note: "new belief", day: 1 } };
  fork.events[0].turn = 3;
  const diff = diffRuns(base, fork);
  assert.ok(diff.firstDivergence);
  assert.deepEqual(
    new Set(diff.divergedPeople.find((d) => d.day === 1)?.people),
    new Set(["anselm", "lysander"]),
  );
});
