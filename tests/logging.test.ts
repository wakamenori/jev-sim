import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type TestContext, test } from "node:test";
import { APICallError } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";
import { createJevClient } from "../src/jev.ts";
import { createLlmClient } from "../src/llm.ts";
import { errorInfo, type ModelEvent } from "../src/model-events.ts";
import { runSim } from "../src/run.ts";
import { createRunLog } from "../src/run-log.ts";
import { buildWorld } from "../src/world.ts";
import { evaluator, generate } from "./fixtures/decisions.ts";

const json = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const events = (dir: string) =>
  readFileSync(join(dir, "events.jsonl"), "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));

function temporary(t: TestContext) {
  const dir = mkdtempSync(join(tmpdir(), "jev-logging-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

test("run persists ordered phases and a completed checkpoint without request noise on stdout", async (t) => {
  const dir = temporary(t);
  const output: string[] = [];
  const ask = evaluator(buildWorld());
  const result = await runSim(
    { until: 1, outputDir: dir, print: (line) => output.push(line) },
    (observe) => ({
      ...createJevClient({
        observe,
        request: async (state, questions) => ({ answers: await ask(state, questions), inputTokens: 1 }),
      }),
      generate,
      llmStats: { calls: 0, cacheHits: 0, inputTokens: 0, outputTokens: 0, ms: 0 },
    }),
  );
  const logDir = join(dir, "logs", readdirSync(join(dir, "logs"))[0]);
  const status = json(join(logDir, "status.json"));
  assert.equal(status.status, "completed");
  assert.equal(status.completedDay, 1);
  assert.equal(status.activeRequests, 0);
  assert.equal(json(join(logDir, "checkpoint.json")).day, 1);
  assert.deepEqual(json(result.file), JSON.parse(JSON.stringify(result.world)));
  const trace = events(logDir);
  assert.deepEqual(
    trace.filter((e) => e.type === "phase.started").map((e) => e.phase.name),
    ["planning", "turn", "turn", "turn", "evaluation", "review"],
  );
  assert.equal(trace.at(-1).type, "run.completed");
  const request = trace.find((e) => e.type === "request.succeeded");
  assert.ok(request.requestId && request.phase && request.durationMs >= 0);
  assert.equal(output.length, 3); // start (with path), one completed day, finish
  assert.ok(output.every((line) => !/attempt|retry|cache|tokens/.test(line)));
});

test("failed run keeps last completed checkpoint separate from partial world", async (t) => {
  const dir = temporary(t);
  const ask = evaluator(buildWorld());
  let plans = 0;
  const failure = Object.assign(new Error("private provider body"), { isRetryable: false, statusCode: 400 });
  await assert.rejects(
    runSim({ until: 2, outputDir: dir, print: () => {} }, (observe) => ({
      ...createJevClient({
        observe,
        request: async (state, questions) => ({ answers: await ask(state, questions), inputTokens: 1 }),
      }),
      generate: async (args) => {
        if (args.system.startsWith("You are the private strategic mind") && ++plans > 3) throw failure;
        return generate(args);
      },
      llmStats: { calls: 0, cacheHits: 0, inputTokens: 0, outputTokens: 0, ms: 0 },
    })),
    (error) => error === failure,
  );
  const logDir = join(dir, "logs", readdirSync(join(dir, "logs"))[0]);
  const status = json(join(logDir, "status.json"));
  assert.equal(status.status, "failed");
  assert.equal(status.completedDay, 1);
  assert.equal(status.phase.name, "planning");
  assert.equal(status.phase.day, 2);
  assert.equal(status.failure.status, 400);
  assert.equal(json(join(logDir, "checkpoint.json")).day, 1);
  assert.equal(json(join(logDir, "partial-world.json")).day, 2);
  assert.equal(existsSync(join(dir, "runs")), false);
  assert.ok(!readFileSync(join(logDir, "events.jsonl"), "utf8").includes("private provider body"));
});

test("Jev retries retain the failed attempt and recovery under one request id", async () => {
  const entries: ModelEvent[] = [];
  let calls = 0;
  const client = createJevClient({
    observe: (entry) => entries.push(entry),
    request: async () => {
      if (++calls === 1) throw Object.assign(new Error("overloaded"), { statusCode: 503 });
      return { answers: {}, inputTokens: 10 };
    },
  });
  await client.ask("secret prompt", {});
  assert.deepEqual(
    entries.map((e) => e.type),
    [
      "request.started",
      "attempt.started",
      "attempt.failed",
      "request.retry",
      "attempt.started",
      "request.succeeded",
    ],
  );
  assert.equal(new Set(entries.map((e) => e.requestId)).size, 1);
  assert.equal(entries[2].error?.status, 503);
  assert.equal(entries[2].error?.category, "overloaded");
  assert.equal(entries.at(-1)?.attempt, 2);
  assert.ok(!JSON.stringify(entries).includes("secret prompt"));
});

test("LLM logs SDK retries and terminal failures without changing retry policy", async () => {
  const entries: ModelEvent[] = [];
  let calls = 0;
  const model = new MockLanguageModelV4({
    doGenerate: async () => {
      if (++calls === 1)
        throw new APICallError({
          message: "rate limit",
          url: "https://example.invalid",
          requestBodyValues: {},
          statusCode: 429,
          responseHeaders: { "retry-after-ms": "1" },
        });
      return {
        content: [{ type: "text", text: '{"ok":true}' }],
        finishReason: { unified: "stop", raw: "stop" },
        usage: {
          inputTokens: { total: 5, noCache: 5, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 3, text: 3, reasoning: 0 },
        },
        warnings: [],
      };
    },
  });
  const client = createLlmClient(
    undefined,
    (entry) => entries.push(entry),
    () => model,
  );
  const input = { system: "private system", prompt: "private prompt", schema: z.object({ ok: z.boolean() }) };
  assert.deepEqual(await client.generate(input), { ok: true });
  assert.equal(calls, 2);
  assert.equal(entries.filter((e) => e.type === "attempt.failed")[0].error?.status, 429);
  assert.equal(entries.at(-1)?.type, "request.succeeded");
  assert.equal(entries.at(-1)?.attempt, 2);
  await client.generate(input);
  assert.equal(entries.at(-1)?.type, "cache.hit");
  assert.equal(calls, 2);
  assert.ok(!JSON.stringify(entries).includes("private"));
  const terminal = createLlmClient(
    undefined,
    (entry) => entries.push(entry),
    () =>
      new MockLanguageModelV4({
        doGenerate: async () => {
          throw new APICallError({
            message: "invalid",
            url: "https://example.invalid",
            requestBodyValues: {},
            statusCode: 400,
          });
        },
      }),
  );
  await assert.rejects(terminal.generate(input));
  assert.equal(entries.at(-1)?.type, "request.failed");
  assert.equal(entries.at(-1)?.attempt, 1);
});

test("status reports quiet in-flight work and does not revert after late completion", async (t) => {
  const dir = temporary(t);
  const output: string[] = [];
  const log = createRunLog(dir, "test", (line) => output.push(line));
  t.after(() => log.finish("failed"));
  log.observePhase({ name: "turn", day: 2, turn: 1 }, "started");
  log.observe({ type: "request.started", model: "test", requestId: "pending" });
  log.observe({ type: "attempt.started", model: "test", requestId: "pending", attempt: 1 });
  await new Promise((resolve) => setTimeout(resolve, 1100));
  const status = json(join(dir, "status.json"));
  assert.equal(status.activeRequests, 1);
  assert.equal(status.oldestRequest.requestId, "pending");
  assert.equal(output.length, 1);
  log.finish("failed", new Error("failed"));
  log.observe({ type: "request.succeeded", model: "test", requestId: "pending" });
  assert.equal(json(join(dir, "status.json")).status, "failed");
  assert.equal(json(join(dir, "status.json")).activeRequests, 0);
});

test("error records exclude raw messages, headers and bodies but retain nested network codes", () => {
  const error = Object.assign(new Error("Bearer private-secret fetch failed"), {
    responseHeaders: { authorization: "private-secret" },
    responseBody: "private-secret",
    cause: Object.assign(new Error("private-secret"), { code: "ENOTFOUND" }),
  });
  const info = errorInfo(error);
  assert.equal(info.category, "network");
  assert.equal(info.cause?.code, "ENOTFOUND");
  assert.ok(!JSON.stringify(info).includes("private-secret"));
});

test("SIGTERM saves interrupted status and partial world without publishing a completed result", {
  timeout: 10000,
}, async (t) => {
  const dir = temporary(t);
  const source = `import {runSim} from './src/run.ts';
    await runSim({until:1,outputDir:${JSON.stringify(dir)},handleSignals:true}, () => ({
      ask:async()=>({}),generate:async()=>{console.log('READY');await new Promise(r=>setTimeout(r,30000));},
      stats:{calls:0,cacheHits:0,retries:0,inputTokens:0,ms:0},
      llmStats:{calls:0,cacheHits:0,inputTokens:0,outputTokens:0,ms:0},saveCache(){}
    }));`;
  const child = spawn(process.execPath, ["--experimental-strip-types", "--input-type=module", "-e", source], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  t.after(() => {
    if (child.exitCode === null) child.kill("SIGKILL");
  });
  let output = "";
  let signalled = false;
  child.stdout.on("data", (chunk) => {
    output += chunk;
    if (!signalled && output.includes("READY")) {
      signalled = true;
      child.kill("SIGTERM");
    }
  });
  const code = await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", resolve);
  });
  assert.equal(code, 143);
  const logDir = join(dir, "logs", readdirSync(join(dir, "logs"))[0]);
  assert.equal(json(join(logDir, "status.json")).status, "interrupted");
  assert.equal(json(join(logDir, "status.json")).failure.code, "SIGTERM");
  assert.equal(json(join(logDir, "checkpoint.json")).day, 0);
  assert.equal(json(join(logDir, "partial-world.json")).day, 1);
  assert.equal(existsSync(join(dir, "runs")), false);
});
