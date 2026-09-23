// 個人の整理。毎日の終わりに、全員について Luna が本人の視点で頭の中を整理する。
//   1. 他人についての推測（誰が誰を支持しているか）
//   2. 頭目に報告するか（本人が選ぶ種類だけ。必ず届く種類はコードで組み立てる）
//   3. 翌日の自分の狙いと、打ちたい手
// 本心の支持は変えない（支持は出来事への反応として Jev が決める）。
import { z } from "zod";
import { KING } from "./cast.ts";
import { DEFAULT_LLM, generate } from "./llm.ts";
import { sightingLine } from "./perception.ts";
import {
  addKnowers,
  candidates,
  describe,
  describeAction,
  enumerateActions,
  factionOf,
  remember,
  sameSide,
  TURNS,
} from "./sim.ts";
import { KINDS, toKey } from "./strategy.ts";
import type { Id, World } from "./types.ts";

const name = (w: World, id: Id) => w.people[id]?.name ?? id;

/** pid が報告する相手（陣営の頭目）。頭目本人、属さない人、恐れて従っている人には無い */
export function leaderOf(w: World, pid: Id): Id | undefined {
  const c = w.minds[pid].support;
  if (c === "undecided" || !factionOf(w, c).includes(pid)) return undefined;
  const lead = Object.values(w.people).find((p) => p.advisorOf === c)?.id;
  return lead && lead !== pid ? lead : undefined;
}

export async function reviewPerson(w: World, pid: Id, model = DEFAULT_LLM) {
  const m = w.minds[pid];
  const others = Object.keys(w.people).filter((id) => id !== pid && id !== KING && !w.people[id].candidate);
  const lead = leaderOf(w, pid);
  const ids: [string, ...string[]] = ["none", ...Object.keys(w.people)];
  const factIds: [string, ...string[]] = ["none", ...Object.keys(w.facts)];
  const stance: [string, ...string[]] = ["unknown", "undecided", ...candidates(w).map((c) => c.id)];
  const schema = z.object({
    beliefs: z
      .array(
        z.object({
          person: z.enum(others as [string, ...string[]]),
          support: z.enum(stance).describe('whom you now believe they back; "unknown" if you cannot tell'),
          note: z.string().describe("the reason, in a few words"),
        }),
      )
      .describe("your current guess about each person's allegiance, based only on what you know"),
    reportThreats: z
      .boolean()
      .describe("if you were threatened or gave in to a threat today, do you tell your faction leader?"),
    reportRivalApproaches: z
      .boolean()
      .describe("if people from other sides approached you today, do you tell your faction leader?"),
    shareEvidence: z
      .array(z.enum(["none", ...Object.keys(w.evidence)] as [string, ...string[]]))
      .describe(
        "evidence you keep that you now tell your faction you hold, so any of them can show it; keep private anything you hold as insurance against your own side",
      ),
    aims: z.array(z.string()).describe("1-3 short aims for tomorrow, in your own interest"),
    moves: z
      .array(
        z.object({
          kind: z.enum(KINDS),
          target: z.enum(ids),
          fact: z.enum(factIds),
          visitor: z.enum(ids),
          host: z.enum(ids),
          channel: z.enum(["none", "king", "court", ...Object.keys(w.people)] as [string, ...string[]]),
          evidence: z.enum(["none", ...Object.keys(w.evidence)] as [string, ...string[]]),
          purpose: z.string(),
        }),
      )
      .describe(`up to ${TURNS} moves you intend for tomorrow, chosen from your list`),
  });
  const system = [
    `You are the private mind of ${w.people[pid].name}. At the end of the day, you take stock.`,
    "Guess where each person stands using only what you have seen and heard. Public words can hide private loyalties.",
    lead
      ? `You belong to a faction led by ${name(w, lead)}. Your leader will ask you to carry out a plan; you weigh it against your own interests.`
      : "You belong to no faction's inner circle. You act on your own interests.",
    "Choose tomorrow's moves only from your list of possible moves. Weigh your own safety, your loyalties and your fears.",
    "A bare public accusation is usually dismissed as slander; it is believed only once many at court have already heard the story from several people, or when the accuser shows evidence.",
  ].join("\n\n");
  const prompt = [
    describe(w, pid),
    "",
    `People (ids): ${Object.keys(w.people)
      .map((id) => `${id} = ${name(w, id)}`)
      .join(", ")}`,
    `Fact ids: ${Object.values(w.facts)
      .map((f) => `${f.id} = ${f.text}`)
      .join(" | ")}`,
    "",
    `Your possible moves (keys): ${enumerateActions(w, pid).join(", ")}`,
    "",
    `Day ${w.day} of ${w.totalDays} is over. Take stock and plan tomorrow.`,
  ].join("\n");

  const out = await generate({ model, system, prompt, schema, schemaVersion: "review-v6" });

  return () => {
    for (const b of out.beliefs) {
      if (b.person === pid || w.people[b.person]?.candidate) continue;
      m.beliefs[b.person] = { support: b.support, note: b.note, day: w.day };
    }
    const valid = new Set(enumerateActions(w, pid));
    const moves = out.moves
      .map((x) => ({ action: toKey(x), purpose: x.purpose }))
      .filter((x) => valid.has(x.action))
      .slice(0, TURNS);
    m.intention = { day: w.day + 1, aims: out.aims, moves };
    if (lead) report(w, pid, lead, out.reportThreats, out.reportRivalApproaches);
    shareEvidence(w, pid, out.shareEvidence);
  };
}

/**
 * 預かっている証拠を陣営に知らせる。知らされた仲間は、その証拠を示せるようになる（事実を知っていれば）。
 * 知らせるかは預かり手が選ぶ（仲間への保険として隠す証拠もある）
 */
function shareEvidence(w: World, pid: Id, ids: string[]) {
  const c = w.minds[pid].support;
  if (c === "undecided") return;
  const members = factionOf(w, c);
  if (!members.includes(pid)) return;
  for (const id of ids) {
    const e = w.evidence[id];
    if (!e || e.holder !== pid) continue;
    for (const mm of members) {
      if (mm === pid || w.minds[mm].knownHolders[id] === pid) continue;
      w.minds[mm].knownHolders[id] = pid;
      remember(w, mm, `${name(w, pid)} told the faction they keep ${e.name}.`);
    }
  }
}

/**
 * 頭目への報告。必ず届くもの（自分の行動と結果、聞いた事実、目撃、自陣営からの依頼や口止め）と、
 * 本人が選んだもの（脅されたこと、他陣営からの働きかけ）。
 * 報告された事実と目撃は、頭目の知識にも入る（陣営の内側で情報が集まる）。
 */
function report(w: World, pid: Id, lead: Id, threats: boolean, rivals: boolean) {
  const m = w.minds[pid];
  const lm = w.minds[lead];
  const lines: string[] = [];
  for (const a of m.actionLog.filter((x) => x.day === w.day))
    lines.push(`${describeAction(w, pid, a.action)} → ${a.outcome}`);
  for (const k of m.knowledge.filter((x) => x.day === w.day && x.source !== "self")) {
    lines.push(`heard from ${name(w, k.source)}: "${w.facts[k.factId].text}"`);
    if (!lm.knowledge.some((x) => x.factId === k.factId))
      lm.knowledge.push({ factId: k.factId, belief: k.belief, source: pid, via: k.source, day: w.day });
    addKnowers(w, lead, k.factId, [pid, k.source, ...w.facts[k.factId].parties]);
  }
  // 目撃は新しいもの 5 件まで（見張りの範囲が広い人の報告が、頭目への入力を埋めないように）
  for (const s of m.sightings.filter((x) => x.day === w.day).slice(-5)) {
    lines.push(sightingLine(w, s).slice(2));
    lm.sightings.push({ ...s, source: pid });
  }
  for (const t of m.testimony.filter((x) => x.day === w.day)) {
    const fromOurSide = sameSide(w, pid, t.from);
    const fact = w.facts[t.about]?.text;
    if ((t.kind === "request" || t.kind === "silence") && fromOurSide)
      lines.push(
        `${name(w, t.from)} asked me to ${t.kind === "request" ? "report to the King" : "keep secret"}: "${fact}"`,
      );
    else if (t.kind === "threat" && threats)
      lines.push(
        `${name(w, t.from)} threatened to expose "${fact}" unless I back ${name(w, t.candidate ?? "")}; I ${t.agreed ? "gave in" : "refused"}`,
      );
    else if ((t.kind === "urge" || t.kind === "request" || t.kind === "silence") && !fromOurSide && rivals)
      lines.push(`${name(w, t.from)} approached me (${t.kind})${fact ? `: "${fact}"` : ""}`);
  }
  if (lines.length) lm.reports.push({ day: w.day, from: pid, lines });
}

/** 王以外の全員の整理を並列に行い、決まった順で書き戻す */
export async function reviewAll(w: World, model?: string) {
  const ids = Object.keys(w.people).filter((id) => id !== KING);
  const applies = await Promise.all(ids.map((id) => reviewPerson(w, id, model)));
  for (const apply of applies) apply();
}
