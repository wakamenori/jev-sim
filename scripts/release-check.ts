// 解放の確認（Jev を使わない）。司教を「Petra に脅されて Theodric 支持」にしてから解放し、支持が戻るかを見る
import { buildWorld, factionOf, releaseCoerced } from "../src/sim.ts";

const w = buildWorld();
w.day = 7;
const m = w.minds.anselm;
m.coercedBy = { by: "petra", fact: "f_lands", day: 7, previousSupport: m.support };
m.allegiance = "coerced";
m.support = "theodric";
console.log(
  `解放前: 支持 ${m.support} / ${m.allegiance} / Theodric 陣営に入っているか ${factionOf(w, "theodric").includes("anselm")}`,
);
const cause = { id: 0, day: 11, actor: "king", kind: "exposed", text: "", causes: [] };
w.day = 11;
releaseCoerced(w, "f_lands", cause, "は弱みが暴かれ、脅しから解放された");
console.log(
  `解放後: 支持 ${m.support} / ${m.allegiance} / Theodric 陣営 ${factionOf(w, "theodric").includes("anselm")} / Cedric 陣営 ${factionOf(w, "cedric").includes("anselm")}`,
);
for (const e of w.events) console.log(`  ${e.kind}: ${e.text}`);
