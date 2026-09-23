import { readFileSync, writeFileSync } from "node:fs";
import {
  evidenceDefs,
  exposureEffects,
  facts,
  initialKnowledge,
  people,
  TOTAL_DAYS,
} from "../../src/cast.ts";
import { TURNS } from "../../src/constants.ts";

const path = new URL("../../docs/scenario.md", import.meta.url);
const name = (id: string) => people.find((person) => person.id === id)?.name ?? id;
const names = (ids: string[]) => ids.map(name).join("、") || "なし";
const sections = facts.map((fact) => {
  const evidence = evidenceDefs.filter((e) => e.fact === fact.id);
  const effect = exposureEffects[fact.id];
  return [
    `## ${fact.id}`,
    "",
    fact.text,
    "",
    `- 関係者：${names(fact.about)}`,
    `- 当事者：${names(fact.parties)}`,
    `- 暴かれて困る人：${names(fact.harms)}`,
    `- 初期の知識：${names(Object.keys(initialKnowledge).filter((id) => initialKnowledge[id].includes(fact.id)))}`,
    `- 証拠：${evidence.map((e) => `${e.id} — ${e.name}（${name(e.holder)}）`).join("、") || "なし"}`,
    `- 暴露の効果：${effect?.text ?? "なし"}`,
    ...(effect?.loseAccess ?? []).map((id) => `- 王への接触を失う：${name(id)}`),
    ...(effect?.gainAccess ?? []).map((id) => `- 王への接触を得る：${name(id)}`),
    ...(effect?.opinionShift ?? []).map(
      (s) => `- 評価の変化：${name(s.who)} → ${name(s.candidate)} ${s.delta}`,
    ),
    ...(effect?.trustShift ?? []).map((s) => `- 全員の信頼の変化：${name(s.about)} ${s.delta}`),
  ].join("\n");
});
const output = [
  "# シナリオ定義",
  "",
  "このファイルは `src/cast.ts` と `src/constants.ts` から生成します。直接編集せず、定義を変更した後に `pnpm docs:generate` を実行してください。",
  "",
  `${people.length}人、${facts.length}件の事実、${evidenceDefs.length}件の証拠。${TOTAL_DAYS}日間、1日${TURNS}ターン。`,
  "",
  sections.join("\n\n"),
  "",
].join("\n");
if (process.argv.includes("--check")) {
  if (readFileSync(path, "utf8") !== output)
    throw new Error("シナリオ資料が古くなっています。pnpm docs:generate を実行してください。");
  console.log("Scenario documentation matches its definitions.");
} else writeFileSync(path, output);
