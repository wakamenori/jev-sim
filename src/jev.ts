import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { type Experimental_EvaluationQuestion, experimental_evaluate as evaluate } from "ai";

export const MODEL = "typesafe-ai/jev";
const CACHE_PATH = "cache/jev-cache.json";

export type Questions = Record<string, Experimental_EvaluationQuestion>;
export type Probabilities = Record<string, number>;
export type Answer =
  | { type: "choice"; choice: string; probabilities: Probabilities }
  | { type: "score"; score: number; probabilities: Probabilities }
  | { type: "boolean"; probability: number };
export type Answers = Record<string, Answer>;
/** 回答を種類ごとに取り出す。種類が違えばバグなので落とす */
export function choice(a: Answer): Probabilities {
  if (a.type !== "choice") throw new Error(`expected choice, got ${a.type}`);
  return a.probabilities;
}
export function score(a: Answer): { score: number; probabilities: Probabilities } {
  if (a.type !== "score") throw new Error(`expected score, got ${a.type}`);
  return a;
}
export function bool(a: Answer): number {
  if (a.type !== "boolean") throw new Error(`expected boolean, got ${a.type}`);
  return a.probability;
}

let cache: Record<string, Answers> | undefined;
let dirty = false;
export const stats = { calls: 0, cacheHits: 0, inputTokens: 0, ms: 0, retries: 0 };

function loadCache(): Record<string, Answers> {
  if (!cache) cache = existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, "utf8")) : {};
  return cache as Record<string, Answers>;
}

export function saveCache() {
  if (!dirty || !cache) return;
  mkdirSync("cache", { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify(cache));
  dirty = false;
}

/**
 * state と questions のハッシュでメモ化した Jev 呼び出し。
 * 同じ入力は必ず同じ回答を返すので、世界は入力に対して決定的になる。
 */
export async function ask(state: string, questions: Questions): Promise<Answers> {
  const c = loadCache();
  const key = createHash("sha256").update(JSON.stringify({ MODEL, state, questions })).digest("hex");
  if (c[key]) {
    stats.cacheHits++;
    return c[key];
  }
  const t0 = performance.now();
  const r = await withLimit(() =>
    withBackoff(() => evaluate({ model: MODEL, state, questions, maxRetries: 0 })),
  );
  stats.ms += performance.now() - t0;
  stats.calls++;
  stats.inputTokens += r.usage.inputTokens ?? 0;
  c[key] = r.answers as Answers;
  dirty = true;
  return c[key];
}

// ---- 同時実行の制限と 503 バックオフ
const CONCURRENCY = 32;
let running = 0;
const waiting: (() => void)[] = [];
async function withLimit<T>(fn: () => Promise<T>): Promise<T> {
  if (running >= CONCURRENCY) await new Promise<void>((res) => waiting.push(res));
  running++;
  try {
    return await fn();
  } finally {
    running--;
    waiting.shift()?.();
  }
}
/**
 * 提供元の「高負荷」エラーは約 0.2 秒で返るので、短い間隔で何度もやり直す。
 * SDK 内部の再試行は数秒単位で待つので使わない（maxRetries: 0）。
 */
async function withBackoff<T>(fn: () => Promise<T>, attempts = 30): Promise<T> {
  let delay = 150;
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const retryable = (e as { isRetryable?: boolean }).isRetryable !== false;
      if (!retryable || i >= attempts - 1) throw e;
      stats.retries++;
      await new Promise((r) => setTimeout(r, delay * (0.5 + Math.random())));
      delay = Math.min(delay * 1.5, 2000);
    }
  }
}

/** mulberry32。NPC ごとに独立した乱数列を持たせる */
export function makeRng(seed: string) {
  let a = 0;
  for (const ch of seed) a = (a * 31 + ch.charCodeAt(0)) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 分布からサンプリング。argmax だと ±0.05 の揺れで結果が反転するので使わない */
export function sample(probabilities: Record<string, number>, rnd: () => number): string {
  const entries = Object.entries(probabilities).sort((a, b) => a[0].localeCompare(b[0]));
  const total = entries.reduce((s, [, p]) => s + p, 0) || 1;
  let r = rnd() * total;
  for (const [k, p] of entries) {
    r -= p;
    if (r <= 0) return k;
  }
  return entries[entries.length - 1][0];
}

/**
 * 最有力の候補に近いものだけからサンプリングする。
 * 最大確率の ratio 倍未満は捨て、残りも上位 topK 個までにして、正規化し直す。
 * 選択肢が数十あると、確率の低い候補の合計が大きくなり、ありえない行動を頻繁に引いてしまう。
 * （1/4 では、確率 0.1 前後の自滅的な手が残って引かれていた）
 */
export function sampleFocused(
  probabilities: Record<string, number>,
  rnd: () => number,
  ratio = 0.5,
  topK = 3,
): string {
  const max = Math.max(...Object.values(probabilities));
  const kept = Object.entries(probabilities)
    .filter(([, p]) => p >= max * ratio)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, topK);
  return sample(Object.fromEntries(kept), rnd);
}

export function argmax(probabilities: Record<string, number>): string {
  return Object.entries(probabilities).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0][0];
}

export function fmt(p: Record<string, number> | undefined, top = 4): string {
  if (!p) return "-";
  return Object.entries(p)
    .sort((a, b) => b[1] - a[1])
    .slice(0, top)
    .map(([k, v]) => `${k}:${v.toFixed(2)}`)
    .join(" ");
}
