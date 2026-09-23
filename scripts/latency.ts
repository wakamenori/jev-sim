// Jev の遅延を、state の長さと同時実行数ごとに測る
import { experimental_evaluate as evaluate } from "ai";
import { KING } from "../src/cast.ts";
import { buildWorld, describe } from "../src/sim.ts";

const w = buildWorld();
w.day = 1;
const long = describe(w, "lysander");
const short = "You are Lysander, advisor to Prince Cedric.";
const q = (i: number) => ({
  x: {
    type: "choice" as const,
    instructions: `Whom does Lysander approach? (${i})`,
    criteria: Object.fromEntries(
      Object.keys(w.people)
        .filter((k) => k !== KING)
        .map((k) => [k, w.people[k].name]),
    ),
  },
});

async function one(state: string, i: number) {
  const t0 = performance.now();
  try {
    const r = await evaluate({
      model: "typesafe-ai/jev",
      state: `${state}\n(run ${i})`,
      questions: q(i),
      maxRetries: 0,
    });
    return { ms: performance.now() - t0, tok: r.usage.inputTokens ?? 0, err: "" };
  } catch (e) {
    return { ms: performance.now() - t0, tok: 0, err: String((e as Error).message).slice(0, 60) };
  }
}
const stat = (xs: { ms: number; err: string; tok: number }[]) => {
  const ms = xs.map((x) => x.ms).sort((a, b) => a - b);
  return `p50=${ms[Math.floor(ms.length / 2)].toFixed(0)}ms max=${ms.at(-1)?.toFixed(0)}ms tok=${xs[0].tok} errors=${xs.filter((x) => x.err).length} ${xs.find((x) => x.err)?.err ?? ""}`;
};
console.log("long state chars", long.length);
for (const [label, state] of [
  ["short", short],
  ["long", long],
] as const) {
  for (const n of [1, 4, 16, 32]) {
    const t0 = performance.now();
    const rs = await Promise.all(Array.from({ length: n }, (_, i) => one(state, Date.now() + i)));
    console.log(
      `${label.padEnd(5)} x${String(n).padEnd(3)} wall=${(performance.now() - t0).toFixed(0)}ms ${stat(rs)}`,
    );
  }
}
