// 汎用 LLM（AI Gateway 経由）。頻度の低い上位の判断（陣営の戦略など）に使う。
// Jev と同じく、入力のハッシュで出力を保存し、再実行を決定的にする。
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { generateText, Output } from "ai";
import type { z } from "zod";

export const DEFAULT_LLM = "openai/gpt-6-luna";
/** 推論の強さ。参謀の計画は深い推論が要らず、待ち時間の大半を占めるので下げる */
export const reasoningEffort = () => process.env.LLM_EFFORT ?? "low";
const CACHE_PATH = "cache/llm-cache.json";

let cache: Record<string, unknown> | undefined;
export const llmStats = { calls: 0, cacheHits: 0, inputTokens: 0, outputTokens: 0, ms: 0 };

function load(): Record<string, unknown> {
  if (!cache) cache = existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, "utf8")) : {};
  return cache as Record<string, unknown>;
}

function save() {
  mkdirSync("cache", { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify(cache));
}

export async function generate<T>(args: {
  model?: string;
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  /** キャッシュの鍵に含める識別子。スキーマの形が変わったら上げる */
  schemaVersion: string;
}): Promise<T> {
  const model = args.model ?? DEFAULT_LLM;
  const effort = reasoningEffort();
  const c = load();
  const key = createHash("sha256")
    .update(
      JSON.stringify({
        model,
        system: args.system,
        prompt: args.prompt,
        v: args.schemaVersion,
        e: effort,
      }),
    )
    .digest("hex");
  if (key in c) {
    llmStats.cacheHits++;
    return c[key] as T;
  }
  const t0 = performance.now();
  const r = await generateText({
    model,
    system: args.system,
    prompt: args.prompt,
    output: Output.object({ schema: args.schema }),
    providerOptions: { openai: { reasoningEffort: effort } },
    maxRetries: 3,
  });
  llmStats.ms += performance.now() - t0;
  llmStats.calls++;
  llmStats.inputTokens += r.usage.inputTokens ?? 0;
  llmStats.outputTokens += r.usage.outputTokens ?? 0;
  c[key] = r.output;
  save();
  return r.output as T;
}
