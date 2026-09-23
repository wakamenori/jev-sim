// 実行ログの行動の内訳と、王への説得の回数を出す
import { readFileSync } from "node:fs";
import type { World } from "../src/types.ts";

for (const file of process.argv.slice(2)) {
  const w = JSON.parse(readFileSync(file, "utf8")) as World;
  const acts = w.events.filter((e) => e.kind === "act" || e.kind === "wait");
  const keyOf = (text: string) => /（(.+?)）/.exec(text)?.[1] ?? "wait";
  const mix: Record<string, number> = {};
  for (const e of acts) {
    const kind = keyOf(e.text).split(":")[0];
    mix[kind] = (mix[kind] ?? 0) + 1;
  }
  const urgeKing = acts.filter((e) => keyOf(e.text) === "urge:king").length;
  console.log(file);
  console.log(`  内訳 ${JSON.stringify(mix)}`);
  console.log(`  王への説得 ${urgeKing}`);
}
