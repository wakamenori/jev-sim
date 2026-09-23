// 王が各秘密をどう受け止めるかを、判断の段階ごとに分けて問う診断
import { KING } from "../../src/cast.ts";
import { describe } from "../../src/describe.ts";
import { bool } from "../../src/evaluation.ts";
import { buildWorld } from "../../src/world.ts";
import { ask } from "../models.ts";

for (const [f, who] of [
  ["f_courtship", "Prince Cedric"],
  ["f_debt", "Prince Edmund"],
  ["f_letters", "Prince Theodric"],
] as const) {
  const w = buildWorld();
  w.day = 1;
  w.minds[KING].knowledge.push({ factId: f, belief: 0.9, source: "godfrey", day: 1 });
  w.minds[KING].testimony.push({ day: 1, from: "godfrey", kind: "claim", about: f, eventId: 0 });
  const a = await ask(describe(w, KING), {
    believes: { type: "boolean", instructions: `Does the King believe the report about ${who}?` },
    shame: {
      type: "boolean",
      instructions: `Does the King think this would shame the crown before the church?`,
    },
    betray: { type: "boolean", instructions: `Does the King think ${who} has betrayed the realm?` },
    disq: { type: "boolean", instructions: `Does the King now consider ${who} unfit to be heir?` },
  });
  console.log(
    f.padEnd(12),
    Object.entries(a)
      .map(([k, v]) => `${k}:${bool(v).toFixed(2)}`)
      .join(" "),
  );
}
