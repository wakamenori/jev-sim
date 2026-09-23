import assert from "node:assert/strict";
import { test } from "node:test";
import type { Generate } from "../src/generation.ts";
import { moveSchema, notOrderable } from "../src/planning.ts";
import { reviewPerson } from "../src/review.ts";
import { makePlan } from "../src/strategy.ts";
import { buildWorld } from "../src/world.ts";

const move = {
  kind: "probe",
  target: "godfrey",
  fact: "none",
  visitor: "none",
  host: "none",
  channel: "none",
  evidence: "none",
  purpose: "Observe",
};

test("plans reject impossible and excess moves", async () => {
  const w = buildWorld();
  w.day = 1;
  const generate: Generate = async (args) =>
    args.schema.parse({
      assessment: "Plan",
      aims: ["Observe"],
      moves: [
        { ...move, actor: "lysander", target: "lysander" },
        ...Array.from({ length: 4 }, () => ({ ...move, actor: "lysander" })),
      ],
    });
  const plan = await makePlan(generate, w, "cedric");
  assert.ok(plan);
  assert.equal(plan.moves.length, 3);
  assert.equal(plan.rejected.length, 2);
});

test("both planning paths use one action schema; destructive orders stay personal", () => {
  const w = buildWorld();
  const evidence = Object.values(w.evidence).find((e) => e.holder);
  assert.ok(evidence);
  assert.equal(moveSchema(w).parse(move).kind, "probe");
  assert.throws(() => moveSchema(w).parse({ ...move, kind: "teleport" }));
  assert.match(notOrderable(w, evidence.holder ?? "", `destroy:${evidence.id}`) ?? "", /only the holder/);
});

test("personal review applies beliefs and shares evidence only after generation completes", async () => {
  const w = buildWorld();
  w.day = 1;
  const evidence = Object.values(w.evidence).find((e) => e.holder === "petra");
  assert.ok(evidence);
  delete w.minds.isolde.knownHolders[evidence.id];
  const before = structuredClone(w);
  const generate: Generate = async (args) =>
    args.schema.parse({
      beliefs: [{ person: "hubert", support: "cedric", note: "Observed" }],
      reportThreats: false,
      reportRivalApproaches: false,
      shareEvidence: [evidence.id],
      aims: ["Observe"],
      moves: [move],
    });
  const apply = await reviewPerson(generate, w, "petra");
  assert.deepEqual(w, before);
  apply();
  assert.equal(w.minds.petra.beliefs.hubert.support, "cedric");
  assert.equal(w.minds.isolde.knownHolders[evidence.id], "petra");
  assert.equal(w.minds.petra.support, before.minds.petra.support);
  assert.equal(w.minds.petra.intention?.day, 2);
});
