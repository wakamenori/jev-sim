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
  const total = entries.reduce((s, [, p]) => s + p, 0);
  if (!Number.isFinite(total) || total <= 0 || entries.some(([, p]) => p < 0))
    throw new Error("Invalid probability distribution");
  let r = rnd() * total;
  for (const [k, p] of entries) {
    r -= p;
    if (r < 0) return k;
  }
  const last = entries.filter(([, p]) => p > 0).at(-1);
  if (!last) throw new Error("Invalid probability distribution");
  return last[0];
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
