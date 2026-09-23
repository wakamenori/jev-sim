// 参謀の計画の中の重複と、同じ日のうちの繰り返しを見る
import { readFileSync } from "node:fs";
import type { World } from "../../src/types.ts";

const w = JSON.parse(readFileSync(process.argv[2], "utf8")) as World;
let dupMoves = 0;
let total = 0;
const sameTargetMembers: number[] = [];
for (const p of w.plans) {
  const seen = new Map<string, number>();
  for (const m of p.moves) {
    total++;
    const k = `${m.actor}|${m.action}`;
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  for (const n of seen.values()) if (n > 1) dupMoves += n - 1;
  // 同じ相手への同じ種類の手を、何人のメンバーに割り振ったか
  const byAction = new Map<string, Set<string>>();
  for (const m of p.moves) {
    const s = byAction.get(m.action) ?? new Set();
    s.add(m.actor);
    byAction.set(m.action, s);
  }
  for (const s of byAction.values()) if (s.size > 1) sameTargetMembers.push(s.size);
}
console.log(`計画の一手 ${total}  うち同じメンバーに同じ手の重複 ${dupMoves}`);
console.log(
  `同じ手を複数のメンバーに割り振った件数 ${sameTargetMembers.length}（人数 ${sameTargetMembers.join(",")}）`,
);

// 同じ日のうちに同じ人が同じ手を繰り返した回数
const acts = w.events.filter((e) => e.kind === "act");
const keyOf = (text: string) => /（(.+?)）/.exec(text)?.[1] ?? "";
const perDay = new Map<string, number>();
for (const e of acts) {
  const k = `${e.day}|${e.actor}|${keyOf(e.text)}`;
  perDay.set(k, (perDay.get(k) ?? 0) + 1);
}
const repeats = [...perDay.entries()].filter(([, n]) => n > 1);
const extra = repeats.reduce((s, [, n]) => s + n - 1, 0);
console.log(`同じ日に同じ人が同じ手を 2 回以上: ${repeats.length} 件（余分な回数 ${extra}）`);
const byKind: Record<string, number> = {};
for (const [k, n] of repeats) {
  const kind = k.split("|")[2].split(":").slice(0, 2).join(":");
  byKind[kind] = (byKind[kind] ?? 0) + n - 1;
}
console.log(
  "  その内訳",
  JSON.stringify(
    Object.fromEntries(
      Object.entries(byKind)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8),
    ),
  ),
);
