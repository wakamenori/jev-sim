// 証拠が各 AI にどう見えているかを確かめる。pid の state の証拠の段と、関係する選択肢の文面を出す

import { enumerateActions } from "../../src/actions.ts";
import { describe, describeAction } from "../../src/describe.ts";
import { buildWorld } from "../../src/world.ts";

const pid = process.argv[2] ?? "isolde";
const fact = process.argv[3] ?? "f_skim";
const w = buildWorld();
w.day = 1;
const s = describe(w, pid);
const i = s.indexOf("Evidence:");
console.log("== state の証拠の段");
console.log(i >= 0 ? s.slice(i, s.indexOf("\n\n", i) > 0 ? s.indexOf("\n\n", i) : undefined) : "（なし）");
console.log(`\n== ${fact} に関わる選択肢の文面（Jev に渡る）`);
for (const k of enumerateActions(w, pid)
  .filter((k) => k.includes(fact))
  .slice(0, 4))
  console.log(`- ${describeAction(w, pid, k)}`);
