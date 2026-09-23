import { makePlan } from "../../src/strategy.ts";
// 参謀の計画を、推論の強さごとに立てさせて時間を比べる（day 1 の初期世界、Cedric 陣営）
import { buildWorld } from "../../src/world.ts";
import { generate } from "../models.ts";

const w = buildWorld();
w.day = 1;
for (const e of (process.argv[2] ?? "low,medium").split(",")) {
  process.env.LLM_EFFORT = e;
  const t0 = performance.now();
  try {
    const p = await makePlan(generate, w, "cedric");
    console.log(
      `${e.padEnd(8)} ${((performance.now() - t0) / 1000).toFixed(1)}s moves=${p?.moves.length} rejected=${p?.rejected.length} aims=${p?.aims[0]?.slice(0, 70)}`,
    );
  } catch (err) {
    console.log(`${e.padEnd(8)} ERROR ${String((err as Error).message).slice(0, 120)}`);
  }
}
