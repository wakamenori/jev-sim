// 陣営の参謀。毎日の始めに、側近を参謀としてその日の計画を LLM に立てさせる。
// 出力の人物・事実は列挙型で縛り、一手は Jev の選択肢と同じ鍵にして、今とれる行動かをコードで検証する。
// 計画は各人物の state に「陣営の計画」として入り、選択肢にも印が付く。最終的に選ぶのは Jev。
import { z } from "zod";
import { DEFAULT_LLM, generate } from "./llm.ts";
import {
  backedAtCourt,
  candidates,
  describe,
  describeAction,
  enumerateActions,
  factionOf,
  isOurSecret,
  TURNS,
} from "./sim.ts";
import type { FactionPlan, Id, PlannedMove, World } from "./types.ts";

export const KINDS = [
  "tell",
  "urge",
  "probe",
  "request",
  "threaten",
  "order",
  "silence",
  "accuse",
  "tellseen",
  "give",
  "destroy",
  "extort",
] as const;

const ACTION_GUIDE = `Actions a member can take in one part of the day (there are ${TURNS} parts per day, one action each):
- tell: privately tell a person a fact the member knows (the listener also learns whom the member heard it from)
- urge: press a person to back your candidate
- probe: pry a person for what they know
- request: tell an ally who has access to the King a fact, and ask them to report it to the King in their next action
- threaten: threaten a person who would be hurt if a secret came out to expose it unless they back your candidate. Say how you would expose it (channel): king = tell the King, court = accuse before the court, or a person id = tell that person. If they refuse, you must carry it out by the end of the next day (two days if through the court, to prepare the ground), or they will know your threats are empty. They may threaten you back or go to their leader
- order: order someone who gave in to your threat to report a fact to the King
- silence: ask someone who knows one of your side's secrets to keep it quiet
- accuse: reveal a fact publicly before the court (everyone but the King hears it; the King only learns through those who see him; the fact can no longer be used as a threat). A bare accusation is usually dismissed as slander: the court believes it only if many have already heard the story from several people. Prepare the ground first by spreading it privately
- tellseen: tell a person that someone has been privately visiting someone (use visitor and host)
- Evidence: evidence kept by any member of your faction can be shown by any member whenever they tell or accuse that fact, and those who see it believe it. Evidence turns a doubted rumor into a proven charge. There is no need to pass evidence around inside the faction.
- give: entrust a piece of evidence you keep to someone outside your faction, asking them to present it to the King (or to keep it, if they cannot see him). It changes hands only if they agree; if they agree to present it, they are bound by that promise (use evidence). Handing over evidence that hurts your own side is the holder's own decision and cannot be planned
- extort: threaten the holder of a piece of evidence to hand it over, using a secret that would hurt them (use target, fact and evidence)

Rules that limit the moves:
- A member cannot tell a person a fact that person is already known to know (including the King once he has been told).
- Candidates cannot be urged or threatened; there is no move for advising or encouraging your own candidate.
- A request or a silence that was already agreed to cannot be repeated.
- Each member's list below is exactly what that member can do right now. Plan only moves from those lists.`;

/** 宮廷の名簿。立場は頭目の推測で書く（全員の本心は頭目にも分からない） */
function roster(w: World, lead: Id): string {
  return Object.values(w.people)
    .map((p) => {
      const access = p.accessToKing ? "HAS access to the King" : "no access to the King";
      return `- ${p.id}: ${p.name}, ${p.role}. ${p.publicTraits} (${access}; ${backedAtCourt(w, lead, p.id)})`;
    })
    .join("\n");
}

/**
 * 前日の報告。頭目自身の行動と、メンバーが報告してきたことだけ。
 * メンバーが報告しなかったこと（脅されたことなど）は頭目には見えない。
 */
function yesterday(w: World, lead: Id): string {
  const own = w.minds[lead].actionLog
    .filter((e) => e.day === w.day - 1)
    .map((e) => `- You, part ${e.turn}: ${describeAction(w, lead, e.action)} → ${e.outcome}`);
  const reported = w.minds[lead].reports
    .filter((r) => r.day === w.day - 1)
    .flatMap((r) => r.lines.map((l) => `- ${w.people[r.from].name} reports: ${l}`));
  const lines = [...own, ...reported];
  return lines.length ? lines.join("\n") : "- nothing yet";
}

/** 前日の計画で弾かれた一手と理由。参謀は自分の手がなぜ通らなかったかを知らないと、同じ誤りを繰り返す */
function yesterdayRejected(w: World, candidate: Id): string {
  const plan = w.plans.find((p) => p.day === w.day - 1 && p.faction === candidate);
  if (!plan?.rejected.length) return "- none";
  return plan.rejected.map((r) => `- ${r.move.actor} ${r.move.action}: ${r.reason}`).join("\n");
}

/**
 * 頭目が指示できない手なら、その理由。どちらも預かり手本人の判断にする
 * （頭目は預かり手が証拠を手放せない理由を知らず、指示すると預かり手はそれに従ってしまう）
 *   - 証拠の処分
 *   - 自分や自陣営を困らせる証拠を陣営の外へ渡すこと（実測で、将軍が自分の反逆の証拠を指示どおり差し出した）
 */
function notOrderable(w: World, actor: Id, key: string): string | undefined {
  if (key.startsWith("destroy:")) return "only the holder can decide to destroy evidence";
  if (key.startsWith("give:")) {
    const e = w.evidence[key.split(":")[2]];
    if (e && isOurSecret(w, actor, e.fact))
      return "only the holder can decide to hand over evidence that hurts your own side";
  }
  return undefined;
}

/**
 * メンバーごとの、今とれる手の一覧（Jev の選択肢の鍵そのもの）。
 * 規則を説明するだけでは、参謀は実行できない手を考え続け、弾かれた残りが王への説得だけになる。
 */
function menus(w: World, members: Id[]): string {
  return members
    .map(
      (m) =>
        `- ${m}: ${enumerateActions(w, m)
          .filter((k) => !notOrderable(w, m, k))
          .join(", ")}`,
    )
    .join("\n");
}

export function toKey(m: {
  kind: string;
  target: string;
  fact: string;
  visitor: string;
  host: string;
  channel: string;
  evidence: string;
}): string {
  if (m.kind === "accuse") return `accuse:${m.fact}`;
  if (m.kind === "give") return `give:${m.target}:${m.evidence}`;
  if (m.kind === "destroy") return `destroy:${m.evidence}`;
  if (m.kind === "extort") return `extort:${m.target}:${m.fact}:${m.evidence}`;
  if (m.kind === "threaten") return `threaten:${m.target}:${m.fact}:${m.channel}`;
  if (m.kind === "tellseen") return `tellseen:${m.target}:${m.visitor}:${m.host}`;
  if (m.kind === "urge" || m.kind === "probe") return `${m.kind}:${m.target}`;
  return `${m.kind}:${m.target}:${m.fact}`;
}

export async function makePlan(
  w: World,
  candidate: Id,
  model = DEFAULT_LLM,
): Promise<FactionPlan | undefined> {
  const lead = Object.values(w.people).find((p) => p.advisorOf === candidate)?.id ?? candidate;
  const members = factionOf(w, candidate);
  if (!members.includes(lead)) return undefined;
  const ids: [string, ...string[]] = ["none", ...Object.keys(w.people)];
  const factIds: [string, ...string[]] = ["none", ...Object.keys(w.facts)];
  const schema = z.object({
    assessment: z
      .string()
      .describe("2-3 sentences: where the race stands, the main threat and the main opportunity"),
    aims: z.array(z.string()).describe("1-3 short aims for today only, most important first"),
    moves: z
      .array(
        z.object({
          actor: z.enum(members as [string, ...string[]]).describe("the faction member who acts"),
          kind: z.enum(KINDS),
          target: z.enum(ids).describe('the person approached; "none" for accuse'),
          fact: z.enum(factIds).describe('the fact used; "none" for urge, probe and tellseen'),
          visitor: z.enum(ids).describe('for tellseen: who was visiting; otherwise "none"'),
          host: z.enum(ids).describe('for tellseen: whom they visited; otherwise "none"'),
          channel: z
            .enum(["none", "king", "court", ...Object.keys(w.people)] as [string, ...string[]])
            .describe('for threaten: how you would expose it; otherwise "none"'),
          evidence: z
            .enum(["none", ...Object.keys(w.evidence)] as [string, ...string[]])
            .describe('for give, destroy and extort: the evidence; otherwise "none"'),
          purpose: z.string().describe("one short sentence"),
        }),
      )
      .describe(
        `today's moves: one move for each member for each of the ${TURNS} parts of the day (${TURNS} per member), most important first`,
      ),
  });
  const facts = Object.values(w.facts)
    .map((f) => `- ${f.id}: ${f.text}`)
    .join("\n");
  const system = [
    `You are the private strategic mind of ${w.people[lead].name}, who leads the faction of ${w.people[candidate].name}.`,
    "Plan today's moves for your faction. Think like a real courtier: the King decides but hears only those who can see him; secrets are weapons while held and liabilities when they are your own; threats work on those a secret would hurt; evidence is what makes a charge stick; timing matters.",
    "Coordinate: members who cannot see the King must go through allies who can.",
    "A member can only use facts that member already knows. Use only the listed ids.",
    ACTION_GUIDE,
  ].join("\n\n");
  const prompt = [
    describe(w, lead),
    "",
    `Your faction members (ids): ${members.join(", ")}`,
    "",
    "The court (allegiances are your own best guess):",
    roster(w, lead),
    "",
    "Fact ids:",
    facts,
    "",
    "What you did yesterday and what your members reported to you (learn from it; do not repeat what did not work):",
    yesterday(w, lead),
    "",
    "Moves you planned yesterday that were impossible, and why:",
    yesterdayRejected(w, candidate),
    "",
    "What each member can do right now (move keys are kind:target:fact, threaten:target:fact:channel, urge:target, probe:target, accuse:fact, give:target:evidence, destroy:evidence, extort:target:fact:evidence):",
    menus(w, members),
    "",
    `It is the start of day ${w.day} of ${w.totalDays}. Plan today: give every member ${TURNS} moves, one for each part of the day. A member left without a plan acts on their own and tends to repeat what they did before.`,
  ].join("\n");

  const out = await generate({ model, system, prompt, schema, schemaVersion: "plan-v13" });
  const plan: FactionPlan = {
    day: w.day,
    faction: candidate,
    lead,
    model,
    assessment: out.assessment,
    aims: out.aims,
    moves: [],
    rejected: [],
  };
  // 今とれる行動かを検証する（その日のうちに可能になる手は拾えないが、翌日の計画で拾い直す）
  const count = new Map<Id, number>();
  for (const m of out.moves) {
    const move: PlannedMove = { day: w.day, actor: m.actor, action: toKey(m), purpose: m.purpose };
    const n = count.get(m.actor) ?? 0;
    const reason =
      n >= TURNS
        ? "too many moves for one member"
        : notOrderable(w, m.actor, move.action)
          ? notOrderable(w, m.actor, move.action)
          : !enumerateActions(w, m.actor).includes(move.action)
            ? "not an action the member can take now"
            : undefined;
    if (reason) {
      plan.rejected.push({ move, reason });
      continue;
    }
    count.set(m.actor, n + 1);
    plan.moves.push(move);
  }
  return plan;
}

/** 全陣営の計画を並列に立てる */
export async function planAll(w: World, model?: string): Promise<FactionPlan[]> {
  const plans = await Promise.all(candidates(w).map((c) => makePlan(w, c.id, model)));
  return plans.filter((p): p is FactionPlan => p !== undefined);
}
