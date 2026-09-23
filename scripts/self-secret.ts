// 自分が当事者の秘密を、味方以外（王を含む）に話した場面を洗い出し、なぜ起きたかを見る
import { readFileSync } from "node:fs";
import type { World } from "../src/types.ts";

const w = JSON.parse(readFileSync(process.argv[2], "utf8")) as World;
const keyOf = (text: string) => /（(.+?)）/.exec(text)?.[1] ?? "";
const ev = new Map(w.events.map((e) => [e.id, e]));
for (const e of w.events.filter((x) => x.kind === "act")) {
  const key = keyOf(e.text);
  const [kind, , fact] = key.split(":");
  if (kind !== "tell" && kind !== "request") continue;
  if (!w.facts[fact]?.harms?.includes(e.actor)) continue;
  const d = (e.data as { action?: Record<string, number> })?.action ?? {};
  const top = Object.entries(d)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k, p]) => `${k}:${p.toFixed(2)}`);
  const req = e.causes.map((c) => ev.get(c)).find((c) => c?.kind === "request");
  console.log(
    `d${e.day}t${e.turn} ${e.actor} ${key}  ${req ? `依頼の実行（${req.actor} が頼んだ）` : `本人の選択 p=${(d[key] ?? 0).toFixed(2)} 上位 ${top.join(" ")}`}`,
  );
}
