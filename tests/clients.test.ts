import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { Answers, Questions } from "../src/evaluation.ts";
import { createJevClient } from "../src/jev.ts";
import { cacheKey, createCache } from "../src/model-cache.ts";

const questions: Questions = { yes: { type: "boolean", instructions: "yes?" } };
const answers: Answers = { yes: { type: "boolean", probability: 1 } };

test("cache roundtrips and independent memory caches do not leak", () => {
  const dir = mkdtempSync(join(tmpdir(), "jev-cache-test-"));
  try {
    const path = join(dir, "cache.json");
    const cache = createCache<Answers>(path);
    const key = cacheKey({ state: "state", questions });
    cache.set(key, answers);
    cache.flush();
    assert.deepEqual(createCache<Answers>(path).get(key), answers);
    assert.equal(createCache<Answers>().get(key), undefined);
    assert.notEqual(key, cacheKey({ state: "different", questions }));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("concurrent identical evaluations make one request and share its result", async () => {
  let calls = 0;
  const client = createJevClient({
    request: async () => {
      calls++;
      await new Promise((resolve) => setTimeout(resolve, 5));
      return { answers, inputTokens: 10 };
    },
  });
  const values = await Promise.all(Array.from({ length: 10 }, () => client.ask("state", questions)));
  assert.equal(calls, 1);
  assert.equal(client.stats.calls, 1);
  assert.equal(client.stats.inputTokens, 10);
  assert.ok(values.every((value) => value === values[0]));
  await client.ask("state", questions);
  assert.equal(calls, 1);
  assert.equal(createJevClient().stats.calls, 0);
});

test("the request limit survives queued failures and does not retry terminal errors", async () => {
  let active = 0;
  let max = 0;
  let calls = 0;
  const client = createJevClient({
    request: async (state) => {
      calls++;
      active++;
      max = Math.max(max, active);
      await new Promise((resolve) => setTimeout(resolve, 1));
      active--;
      if (state === "0") throw Object.assign(new Error("invalid request"), { isRetryable: false });
      return { answers, inputTokens: 1 };
    },
  });
  const results = await Promise.allSettled(
    Array.from({ length: 70 }, (_, i) => client.ask(String(i), questions)),
  );
  assert.equal(results.filter((r) => r.status === "rejected").length, 1);
  assert.equal(calls, 70);
  assert.ok(max <= 32);
  await client.ask("after", questions);
  assert.equal(client.stats.calls, 70);
});
