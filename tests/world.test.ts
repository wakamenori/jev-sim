import assert from "node:assert/strict";
import { test } from "node:test";
import { enumerateActions } from "../src/actions.ts";
import { describe } from "../src/describe.ts";
import { perceivedSupport, recordSightings } from "../src/perception.ts";
import { factionOf, releaseCoerced } from "../src/rules.ts";
import { buildWorld, closeDay } from "../src/world.ts";

test("worlds and saved snapshots do not share mutable character state", () => {
  const a = buildWorld();
  const b = buildWorld();
  a.people.lysander.accessToKing = !a.people.lysander.accessToKing;
  a.minds.lysander.trust.godfrey = 0;
  assert.notEqual(a.people.lysander.accessToKing, b.people.lysander.accessToKing);
  assert.notEqual(a.minds.lysander.trust.godfrey, b.minds.lysander.trust.godfrey);
  a.facts.f_debt.harms.length = 0;
  assert.ok(b.facts.f_debt.harms.length > 0);
  a.day = 1;
  closeDay(a);
  a.minds.lysander.knowledge.length = 0;
  assert.ok(a.snapshots[1].minds.lysander.knowledge.length > 0);
});

test("a person's view excludes other people's private traits", () => {
  const w = buildWorld();
  w.people.petra.hiddenTraits = "PRIVATE-PETRA-ONLY";
  assert.ok(!describe(w, "lysander").includes("PRIVATE-PETRA-ONLY"));
  assert.ok(describe(w, "petra").includes("PRIVATE-PETRA-ONLY"));
  delete w.minds.lysander.beliefs.petra;
  assert.equal(perceivedSupport(w, "lysander", "petra"), "unknown");
});

test("audience access limits actions; an accepted request does not force an action", () => {
  const w = buildWorld();
  w.people.lysander.accessToKing = false;
  const actions = enumerateActions(w, "lysander");
  assert.ok(actions.includes("wait"));
  assert.ok(!actions.some((key) => key.split(":")[1] === "king"));
  w.pending.push({
    actor: "lysander",
    from: "hubert",
    day: 0,
    requestEventId: 1,
    action: "tell:king:f_skim",
  });
  assert.ok(enumerateActions(w, "lysander").includes("wait"));
});

test("exposure releases coerced support back to the previous faction", () => {
  const w = buildWorld();
  const m = w.minds.anselm;
  const previous = m.support;
  m.coercedBy = { by: "petra", fact: "f_lands", day: 1, previousSupport: previous };
  m.allegiance = "coerced";
  m.support = "theodric";
  assert.ok(!factionOf(w, "theodric").includes("anselm"));
  releaseCoerced(
    w,
    "f_lands",
    { id: 0, day: 1, actor: "king", kind: "exposed", text: "", causes: [] },
    "released",
  );
  assert.equal(m.support, previous);
  assert.equal(m.coercedBy, undefined);
  assert.ok(factionOf(w, previous).includes("anselm"));
});

test("sightings are reproducible and reveal meetings, not their contents", () => {
  const a = buildWorld();
  const b = buildWorld();
  const meetings = [
    { visitor: "lysander", host: "king" },
    { visitor: "petra", host: "isolde" },
  ];
  recordSightings(a, meetings);
  recordSightings(b, meetings);
  assert.deepEqual(a.minds, b.minds);
  assert.deepEqual(a.minds.godfrey.sightings[0], {
    day: 0,
    turn: 0,
    visitor: "lysander",
    host: "king",
    source: "self",
  });
});
