import assert from "node:assert/strict";
import { test } from "node:test";
import { type ChooseAction, chooseAction } from "../src/decision.ts";
import { createEngine } from "../src/engine.ts";
import { simulate } from "../src/simulation.ts";
import { buildWorld } from "../src/world.ts";
import { evaluator, fixtureWorld, generate } from "./fixtures/decisions.ts";

test("a full run includes ordered events, daily snapshots, reviews and one final decision", async () => {
  const w = await fixtureWorld();
  assert.equal(w.snapshots.length, 3);
  assert.equal(w.kingSuitability.length, 2);
  assert.equal(w.events.filter((e) => e.kind === "name_heir").length, 1);
  assert.equal(w.minds.lysander.intention?.day, 3);
  assert.equal(w.minds.lysander.actionLog.length, 6);
  assert.ok(w.events.some((e) => e.kind === "hear"));
  for (const [index, event] of w.events.entries()) {
    assert.equal(event.id, index + 1);
    assert.ok(event.causes.every((id) => id < event.id && w.events.some((e) => e.id === id)));
  }
  const again = await fixtureWorld();
  assert.deepEqual(w, again);
});

test("incomplete runs do not name an heir; invalid day values fail", async () => {
  const w = buildWorld();
  const decisions = { ask: evaluator(w), generate };
  await simulate(w, decisions, 1);
  assert.ok(!w.events.some((e) => e.kind === "name_heir"));
  for (const until of [NaN, -1, 1.5, 100]) await assert.rejects(simulate(w, decisions, until));
});

test("response completion order cannot change turn results", async () => {
  const run = async (reverse: boolean) => {
    const w = buildWorld();
    w.day = 1;
    w.turn = 1;
    const ask = evaluator(w);
    let i = 0;
    await createEngine(
      async (state, questions) => {
        const answers = await ask(state, questions);
        const order = i++;
        await new Promise((resolve) => setTimeout(resolve, reverse ? 10 - (order % 10) : order % 10));
        return answers;
      },
      async (_w, actor) => ({
        actor,
        action: actor === "petra" || actor === "lysander" ? "urge:godfrey" : "wait",
        raw: {},
      }),
    ).runTurn(w);
    return w;
  };
  assert.deepEqual(await run(false), await run(true));
});

test("changing support reselects the action using the new support", async () => {
  const w = buildWorld();
  w.day = 1;
  w.turn = 1;
  const calls: string[] = [];
  const select: ChooseAction = async (world, actor, askSupport) => {
    if (actor === "anselm") calls.push(`${askSupport}:${world.minds[actor].support}`);
    return {
      actor,
      action: "wait",
      support: actor === "anselm" && askSupport ? "theodric" : undefined,
      raw: {},
    };
  };
  await createEngine(evaluator(w), select).runTurn(w);
  assert.deepEqual(calls, ["true:cedric", "false:theodric"]);
});

test("waiting leaves a promise pending; its eventual action consumes it and records its cause", async () => {
  const w = buildWorld();
  w.day = 1;
  w.turn = 1;
  w.events.push({ id: 1, day: 1, actor: "petra", kind: "request", text: "request", causes: [] });
  w.pending.push({
    actor: "petra",
    from: "isolde",
    day: 1,
    action: "tell:godfrey:f_debt",
    requestEventId: 1,
  });
  const ask = evaluator(w);
  assert.equal((await chooseAction(ask, w, "petra")).action, "wait");
  await createEngine(ask).runTurn(w);
  assert.equal(w.pending.length, 1);
  w.turn = 2;
  await createEngine(ask, async (_w, actor) => ({
    actor,
    action: actor === "petra" ? "tell:godfrey:f_debt" : "wait",
    raw: {},
    fromRequest: 999,
  })).runTurn(w);
  assert.equal(w.pending.length, 0);
  assert.deepEqual(w.events.find((e) => e.kind === "act" && e.actor === "petra")?.causes, [1]);
});

test("a failure while collecting reactions applies none of the actions", async () => {
  const w = buildWorld();
  w.day = 1;
  w.turn = 2;
  const before = structuredClone(w);
  await assert.rejects(
    createEngine(
      async () => {
        throw new Error("provider unavailable");
      },
      async (_w, actor) => ({ actor, action: actor === "petra" ? "tell:godfrey:f_debt" : "wait", raw: {} }),
    ).runTurn(w),
  );
  assert.deepEqual(w, before);
});
