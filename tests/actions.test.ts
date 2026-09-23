import assert from "node:assert/strict";
import { test } from "node:test";
import { enumerateActions, parseAction, toKey } from "../src/actions.ts";
import { bool, choice, score } from "../src/evaluation.ts";
import { makeRng, sample, sampleFocused } from "../src/random.ts";
import { buildWorld } from "../src/world.ts";

test("every generated action roundtrips through the shared format", () => {
  const w = buildWorld();
  for (const id of Object.keys(w.people))
    for (const key of enumerateActions(w, id)) assert.equal(toKey(parseAction(key)), key);
  assert.equal(toKey({ kind: "wait" }), "wait");
  for (const key of ["dance:x", "tell:x", "wait:x", "tell::f_debt", "toString"])
    assert.throws(() => parseAction(key));
});

test("seeded sampling is stable, ignores key order and never selects zero mass", () => {
  const a = makeRng("same");
  const b = makeRng("same");
  for (let i = 0; i < 100; i++) assert.equal(sample({ a: 0.2, b: 0.8 }, a), sample({ b: 0.8, a: 0.2 }, b));
  assert.equal(
    sample({ a: 0, b: 1 }, () => 0),
    "b",
  );
  for (const p of [{}, { a: 0 }, { a: -1, b: 2 }, { a: NaN }, { a: Infinity }] as Record<string, number>[])
    assert.throws(() => sample(p, () => 0.5));
  const rng = makeRng("focused");
  for (let i = 0; i < 100; i++)
    assert.ok(["a", "b", "c"].includes(sampleFocused({ a: 0.4, b: 0.3, c: 0.2, d: 0.15, e: 0.01 }, rng)));
});

test("answer accessors reject unexpected model response types", () => {
  assert.throws(() => choice({ type: "boolean", probability: 1 }));
  assert.throws(() => score({ type: "boolean", probability: 1 }));
  assert.throws(() => bool({ type: "choice", choice: "a", probabilities: { a: 1 } }));
});
