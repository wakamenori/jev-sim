// 告発の言い方で、初めて聞く人の「信じるか」がどう変わるかを測る

import { describe } from "../../src/describe.ts";
import { bool } from "../../src/evaluation.ts";
import type { World } from "../../src/types.ts";
import { buildWorld } from "../../src/world.ts";
import { ask } from "../models.ts";

const listeners = ["godfrey", "anselm", "varric", "brand", "tam"];
const fact = "Chancellor Hubert has been skimming gold from the treasury for years.";
const variants: Record<string, (w: World, id: string) => string> = {
  "1 今の言い方": () => `Just now, before the assembled court, Guildmaster Petra publicly accused: "${fact}"`,
  "2 出所を添える": () =>
    `Just now, before the assembled court, Guildmaster Petra publicly accused: "${fact}" She says she saw it firsthand: the stolen gold passes through her own house.`,
  "3 証拠を示す": () =>
    `Just now, before the assembled court, Guildmaster Petra publicly accused: "${fact}" She laid before the court ledgers from her house showing the treasury's gold flowing to the Chancellor.`,
  "4 既に2人から聞いていた": (w, id) => {
    w.minds[id].knowledge.push({ factId: "f_skim", belief: 0.5, source: "brand", via: "petra", day: 1 });
    w.minds[id].testimony.push({ day: 1, from: "brand", kind: "claim", about: "f_skim", eventId: 0 });
    w.minds[id].testimony.push({ day: 1, from: "wenna", kind: "claim", about: "f_skim", eventId: 0 });
    return `Just now, before the assembled court, Guildmaster Petra publicly accused: "${fact}" You had already heard something like this.`;
  },
};
for (const [label, opener] of Object.entries(variants)) {
  const ps = await Promise.all(
    listeners.map(async (id) => {
      const w = buildWorld();
      w.day = 3;
      const text = opener(w, id);
      const a = await ask(`${describe(w, id)}\n\n${text}`, {
        believe: { type: "boolean", instructions: `Does ${w.people[id].name} believe this claim is true?` },
      });
      return bool(a.believe);
    }),
  );
  const avg = ps.reduce((s, x) => s + x, 0) / ps.length;
  console.log(
    `${label.padEnd(14)} 平均 ${avg.toFixed(2)}  ${listeners.map((id, i) => `${id} ${ps[i].toFixed(2)}`).join(", ")}`,
  );
}
