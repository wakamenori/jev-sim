import assert from "node:assert/strict";
import { test } from "node:test";
import { askThreat } from "../src/reactions/coercion.ts";
import { askGive, destroyEvidence } from "../src/reactions/evidence.ts";
import { askAccusation, askFact, askRequest } from "../src/reactions/information.ts";
import { applyExposure, canUse, lapseThreats } from "../src/rules.ts";
import type { Event } from "../src/types.ts";
import { buildWorld } from "../src/world.ts";
import { evaluator } from "./fixtures/decisions.ts";

const cause: Event = { id: 0, day: 1, actor: "petra", kind: "act", text: "", causes: [] };

test("shared evidence requires knowledge of both the fact and the holder", () => {
  const w = buildWorld();
  const evidence = Object.values(w.evidence).find((e) => e.holder === "petra");
  assert.ok(evidence);
  const m = w.minds.isolde;
  m.knowledge.push({ factId: evidence.fact, source: "petra", belief: 1, day: 1 });
  delete m.knownHolders[evidence.id];
  assert.equal(canUse(w, "isolde", evidence), false);
  m.knownHolders[evidence.id] = "petra";
  assert.equal(canUse(w, "isolde", evidence), true);
  m.allegiance = "coerced";
  assert.equal(canUse(w, "isolde", evidence), false);
});

test("evidence gives belief a floor and repeat hearing does not reassess candidates twice", async () => {
  const w = buildWorld();
  const ask = evaluator(w, {}, 0.1);
  const before = structuredClone(w);
  const apply = await askFact(ask, w, "petra", "godfrey", "f_debt");
  assert.deepEqual(w, before);
  apply(cause);
  assert.equal(w.minds.godfrey.knowledge.find((k) => k.factId === "f_debt")?.belief, 0.85);
  const opinions = { ...w.minds.godfrey.opinions };
  (await askFact(ask, w, "petra", "godfrey", "f_debt"))(cause);
  assert.deepEqual(w.minds.godfrey.opinions, opinions);
});

test("refusing evidence keeps its holder; accepting it creates a voluntary promise", async () => {
  const w = buildWorld();
  const evidence = Object.values(w.evidence).find((e) => e.holder === "petra" && e.fact === "f_debt");
  assert.ok(evidence);
  (await askGive(evaluator(w, {}, 0), w, "petra", "godfrey", evidence.id))(cause);
  assert.equal(evidence.holder, "petra");
  assert.equal(w.pending.length, 0);
  (await askGive(evaluator(w, {}, 1), w, "petra", "godfrey", evidence.id))(cause);
  assert.equal(evidence.holder, "godfrey");
  assert.equal(w.pending[0].action, "tell:king:f_debt");
});

test("a prepared extortion cannot resurrect destroyed evidence", async () => {
  const w = buildWorld();
  const evidence = Object.values(w.evidence).find((e) => e.holder === "petra");
  assert.ok(evidence);
  const apply = await askThreat(
    evaluator(w, { respond: "comply" }),
    w,
    "lysander",
    "petra",
    "f_smuggling",
    "cedric",
    "court",
    evidence.id,
  );
  destroyEvidence(w, "petra", evidence.id)(cause);
  apply(cause);
  assert.equal(evidence.holder, undefined);
});

test("exposure effects happen once; expired threats lose credibility once", () => {
  const w = buildWorld();
  applyExposure(w, "f_skim", cause);
  const after = structuredClone(w);
  applyExposure(w, "f_skim", cause);
  assert.deepEqual(w, after);
  w.day = 3;
  w.threats.push({
    id: 1,
    day: 1,
    from: "petra",
    to: "hubert",
    fact: "f_skim",
    candidate: "theodric",
    channel: "court",
    deadline: 3,
    status: "refused",
  });
  lapseThreats(w);
  lapseThreats(w);
  assert.equal(w.threats.at(-1)?.status, "lapsed");
  assert.equal(w.minds.hubert.reputations.petra.lapsed, 1);
});

test("an accusation heard by exactly half does not meet the majority requirement", async () => {
  const w = buildWorld();
  w.people.extra = { ...w.people.godfrey, id: "extra", name: "Extra listener" };
  w.minds.extra = structuredClone(w.minds.godfrey);
  for (const e of Object.values(w.evidence)) e.holder = undefined;
  let i = 0;
  const apply = await askAccusation(
    async (state, questions) => evaluator(w, {}, i++ < 8 ? 1 : 0)(state, questions),
    w,
    "petra",
    "f_skim",
  );
  apply(cause);
  assert.ok(w.publicFacts.includes("f_skim"));
  assert.ok(!w.exposed.includes("f_skim"));
});

test("request rejection records the conversation without creating a promise", async () => {
  const w = buildWorld();
  (await askRequest(evaluator(w, {}, 0), w, "petra", "godfrey", "f_debt"))(cause);
  assert.equal(w.pending.length, 0);
  assert.ok(w.events.some((e) => e.kind === "request"));
});

test("a complied threat changes support and exposure restores it", async () => {
  const w = buildWorld();
  w.day = 1;
  const previous = w.minds.anselm.support;
  (
    await askThreat(evaluator(w, { respond: "comply" }), w, "petra", "anselm", "f_lands", "theodric", "court")
  )(cause);
  assert.equal(w.minds.anselm.support, "theodric");
  assert.equal(w.minds.anselm.allegiance, "coerced");
  assert.equal(w.threats[0].deadline, 3);
  applyExposure(w, "f_lands", cause);
  assert.equal(w.minds.anselm.support, previous);
  assert.equal(w.threats[0].status, "moot");
});
