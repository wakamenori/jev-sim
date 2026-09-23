import { parseAction } from "./actions.ts";
import { exposureEffects, KING } from "./cast.ts";
import { TURNS } from "./constants.ts";
import { perceivedLabel, recentSightings, sightingLine } from "./perception.ts";
import {
  backedAtCourt,
  candidates,
  canUse,
  doneToday,
  favored,
  isOurSecret,
  knownToKnow,
  myPlan,
  name,
  pendingOf,
  usableEvidence,
} from "./rules.ts";
import type { Id, Mind, Testimony, ThreatChannel, World } from "./types.ts";

const TRUST_WORDS = [
  "deep distrust",
  "distrust",
  "wary",
  "somewhat wary",
  "neutral",
  "somewhat trusting",
  "trusting",
  "very trusting",
  "complete trust",
];
const VIEW_WORDS = [
  "unfit",
  "nearly unfit",
  "doubtful",
  "somewhat doubtful",
  "acceptable",
  "fairly good",
  "good",
  "very good",
  "the best choice",
];
export const word = (words: string[], v: number) => words[Math.max(0, Math.min(8, Math.round(v * 2)))];
export const trustWord = (v: number) => word(TRUST_WORDS, v);
export const viewWord = (v: number) => word(VIEW_WORDS, v);

/** 危機が始まった時点からの変化を言葉にする。小さな変化は言わない */
function trend(now: number, start: number | undefined): string {
  if (start === undefined) return "";
  const d = now - start;
  if (d >= 0.75) return " (much higher than when the crisis began)";
  if (d >= 0.25) return " (higher than when the crisis began)";
  if (d <= -0.75) return " (much lower than when the crisis began)";
  if (d <= -0.25) return " (lower than when the crisis began)";
  return "";
}

/** 事実が pid 自身か自陣営に関わるなら、その旨を書き添える。有利か不利かの判断は Jev に任せる */
export function concerns(w: World, pid: Id, factId: Id | undefined): string {
  if (!factId) return "";
  if (w.facts[factId]?.harms.includes(pid)) return " (exposing this would hurt you yourself)";
  if (w.facts[factId]?.parties.includes(pid)) return " (this concerns you yourself)";
  if (isOurSecret(w, pid, factId)) return " (this concerns your own side)";
  return "";
}

/** pid の陣営の、その日の計画（恐れて従っている人には無い） */
function provenance(w: World, k: Mind["knowledge"][number]): string {
  if (k.source === "self") return "you know this firsthand";
  const via = k.via && k.via !== "self" ? `, who had it from ${name(w, k.via)}` : ", who knew it firsthand";
  const b = k.belief > 0.75 ? "you believe it" : k.belief > 0.4 ? "you half believe it" : "you doubt it";
  return `heard from ${name(w, k.source)}${via}; ${b}`;
}

function testimonyLine(w: World, m: Mind, t: Testimony): string {
  const who = `${name(w, t.from)} (${trustWord(m.trust[t.from] ?? 2)})`;
  const fact = w.facts[t.about]?.text;
  const ans = t.agreed === undefined ? "" : t.agreed ? " You agreed." : " You refused.";
  switch (t.kind) {
    case "claim":
      return `- Day ${t.day}: ${who} told you: "${fact}"`;
    case "urge":
      return `- Day ${t.day}: ${who} urged you to back ${name(w, t.about)}.`;
    case "request":
      return `- Day ${t.day}: ${who} asked you to report to the King: "${fact}".${ans}`;
    case "threat":
      return `- Day ${t.day}: ${who} threatened to expose "${fact}" unless you back ${name(w, t.candidate ?? "")}.${ans}`;
    case "silence":
      return `- Day ${t.day}: ${who} asked you to keep secret: "${fact}".${ans}`;
    case "accusation":
      return `- Day ${t.day}: ${who} publicly accused at court: "${fact}"`;
    case "sighting":
      return `- Day ${t.day}: ${who} told you whom someone had been visiting.`;
  }
}

/** 今日すでに実行した行動の鍵 */
function accessList(w: World): string {
  return Object.values(w.people)
    .filter((p) => p.accessToKing && p.id !== KING)
    .map((p) => p.name)
    .join(", ");
}

/** 脅しに関わる状況: 自分が出した脅しの行方、自分が受けている脅し、知っている他人の脅しの信用、暴かれた秘密 */
function threatSection(w: World, pid: Id): string[] {
  const lines: string[] = [];
  for (const t of w.threats) {
    const fact = w.facts[t.fact]?.text;
    if (t.from === pid && t.status === "refused")
      lines.push(
        `- ${name(w, t.to)} refused your threat over "${fact}". You said you would ${channelText(w, t.channel)}. If you do not by the end of day ${t.deadline}, they will know your threats are empty.`,
      );
    if (t.from === pid && t.status === "deterrent")
      lines.push(`- You hold "${fact}" over ${name(w, t.to)}: if they expose you, you can expose them.`);
    if (t.to === pid && t.status === "refused")
      lines.push(
        `- You refused ${name(w, t.from)}'s threat over "${fact}". They said they would ${channelText(w, t.channel)} by the end of day ${t.deadline}.`,
      );
  }
  const reps = Object.entries(w.minds[pid].reputations)
    .filter(([, r]) => r.kept + r.lapsed > 0)
    .map(([id, r]) => `${name(w, id)} carried out ${r.kept} threat(s) and let ${r.lapsed} lapse`);
  if (reps.length) lines.push(`- What you know of people's threats: ${reps.join("; ")}.`);
  const exposed = w.exposed.map((f) => exposureEffects[f]?.text).filter(Boolean);
  if (exposed.length) lines.push(`- Secrets that came out and what followed: ${exposed.join(" ")}`);
  return lines.length ? [``, `Threats and exposures:`, ...lines] : [];
}

export function channelText(w: World, c: ThreatChannel): string {
  if (c === "king") return "tell the King";
  if (c === "court") return "expose it before the whole court";
  return `tell ${name(w, c)}`;
}

/** 脅しの経路ごとの、実行にあたる行動の鍵 */
function proofText(w: World, pid: Id, factId: Id | undefined): string {
  const e = factId ? usableEvidence(w, pid, factId) : undefined;
  if (!e) return "";
  const keeper = e.holder === pid ? "you keep it" : `kept by ${name(w, e.holder ?? "")}`;
  return ` (you can show ${e.name} as proof, ${keeper}; those who see it will believe it)`;
}

function groundText(w: World, pid: Id, factId: Id | undefined): string {
  if (!factId) return "";
  const heard = [...knownToKnow(w, pid, factId)].filter((x) => x !== KING && x !== pid).length;
  const court = Object.keys(w.people).length - 2;
  return ` (as far as you know, ${heard} of the ${court} others at court have already heard it; a bare accusation is usually dismissed as slander)`;
}

/** 暴かれたら何が起きるか（事実ごとの結果。脅された人が判断に使う） */
export function exposureText(factId: Id): string {
  const e = exposureEffects[factId];
  return e ? ` If this came out: ${e.text}` : "";
}

function intentionSection(w: World, pid: Id): string[] {
  const m = w.minds[pid];
  const lines: string[] = [];
  if (m.allegiance === "coerced" && m.coercedBy) {
    lines.push(
      ``,
      `You are acting under threat: ${name(w, m.coercedBy.by)} will expose "${w.facts[m.coercedBy.fact]?.text}" unless you back ${name(w, m.support)}. You have given in, for now.`,
    );
  }
  const it = m.intention;
  if (it && it.day === w.day) {
    const done = doneToday(w, pid);
    lines.push(``, `Your own aims today: ${it.aims.join(" ")}`);
    if (it.moves.length)
      lines.push(
        `Moves you intended:\n${it.moves.map((x) => `- ${describeAction(w, pid, x.action)} (${x.purpose})${done.has(x.action) ? " [done]" : ""}`).join("\n")}`,
      );
  }
  const pend = pendingOf(w, pid);
  if (pend.length)
    lines.push(
      ``,
      `Promises you made:\n${pend.map((x) => `- You agreed with ${name(w, x.from)} to: ${describeAction(w, pid, x.action)}`).join("\n")}`,
    );
  return lines;
}

function planSection(w: World, pid: Id): string[] {
  const plan = myPlan(w, pid);
  if (!plan) return [];
  const mine = plan.moves.filter((m) => m.actor === pid);
  if (!mine.length)
    return [
      ``,
      `Your faction's plan for today, set by ${name(w, plan.lead)}: ${plan.aims.join(" ")}`,
      "You have no assigned part today.",
    ];
  const done = doneToday(w, pid);
  const line = (m: (typeof mine)[number]) =>
    `- ${describeAction(w, pid, m.action)} (${m.purpose})${done.has(m.action) ? " [done]" : ""}`;
  return [
    ``,
    `Your faction's plan for today, set by ${name(w, plan.lead)}: ${plan.aims.join(" ")}`,
    `Your part today:\n${mine.map(line).join("\n")}`,
  ];
}

/**
 * 自分の行動の記録。同じ行動は回数にまとめ、最後に見えた反応を添える。
 * これが無いと、効果のない行動（王への説得など）を何度でも繰り返す。
 */
function actionHistory(w: World, pid: Id): string {
  const groups = new Map<string, { n: number; lastDay: number; outcome: string }>();
  for (const e of w.minds[pid].actionLog) {
    const g = groups.get(e.action) ?? { n: 0, lastDay: 0, outcome: "" };
    groups.set(e.action, { n: g.n + 1, lastDay: e.day, outcome: e.outcome });
  }
  return [...groups.entries()]
    .sort((a, b) => b[1].lastDay - a[1].lastDay)
    .slice(0, 10)
    .map(
      ([k, g]) =>
        `- ${describeAction(w, pid, k)}: ${g.n === 1 ? "once" : `${g.n} times`}, last on day ${g.lastDay}. Last time: ${g.outcome}.`,
    )
    .join("\n");
}

/** NPC の視点で state を組み立てる。数値は言葉に変換する */
export function describe(w: World, pid: Id): string {
  const p = w.people[pid];
  const m = w.minds[pid];
  const start = w.snapshots[0]?.minds[pid];
  const cands = candidates(w)
    .map((c) => `${c.name} (${c.role})`)
    .join("; ");
  const trustLines = Object.entries(m.trust)
    .filter(([id]) => id !== pid)
    .map(([id, t]) => `${name(w, id)}: ${trustWord(t)}${trend(t, start?.trust[id])}`)
    .join(", ");
  const known = m.knowledge
    .map((k) => {
      const f = w.facts[k.factId];
      const others = [...knownToKnow(w, pid, k.factId)].filter((x) => x !== pid);
      const pub = w.publicFacts.includes(k.factId) ? " It is now public knowledge at court." : "";
      const who =
        !pub && others.length
          ? ` Others you know are aware of it: ${others.map((x) => name(w, x)).join(", ")}.`
          : "";
      const stake = concerns(w, pid, k.factId) ? exposureText(k.factId) : "";
      return `- ${f.text} (${provenance(w, k)}).${concerns(w, pid, k.factId)}${stake}${pub}${who}`;
    })
    .join("\n");
  const seen = recentSightings(w, pid)
    .map((s) => sightingLine(w, s))
    .join("\n");
  const stances = Object.keys(w.people)
    .filter((id) => id !== pid && id !== KING && !w.people[id].candidate)
    .map((id) => {
      const b = m.beliefs[id];
      return `${name(w, id)}: ${perceivedLabel(w, pid, id)}${b?.note && b.note !== "publicly known" ? ` (${b.note})` : ""}`;
    })
    .join("; ");
  const opinionLine = Object.keys(m.opinions).length
    ? `Your current view of the candidates as future king: ${candidates(w)
        .map((c) => {
          const v = m.opinions[c.id] ?? 2;
          return `${c.name}: ${viewWord(v)}${trend(v, start?.opinions?.[c.id])}`;
        })
        .join(", ")}.`
    : "";
  const testimony = m.testimony
    .slice(-12)
    .map((t) => testimonyLine(w, m, t))
    .join("\n");
  const recent = m.recent.map((r) => `- ${r}`).join("\n");
  const done = actionHistory(w, pid);
  // 「あなたは X を支持している」と書くと、それ自体が判断の錨になって何を聞いても動かない。
  // 立場で縛られる候補本人と側近以外は「これまでの傾き」として書く。
  const supportLine = p.candidate
    ? "You are yourself a candidate."
    : p.advisorOf
      ? `You serve ${name(w, p.advisorOf)}.`
      : m.support === "undecided"
        ? "You have not leaned toward any candidate yet."
        : `So far you have leaned toward ${name(w, m.support)}.`;
  const turnLine = w.turn > 0 ? ` It is part ${w.turn} of ${TURNS} of the day.` : "";
  return [
    `You are ${p.name}, ${p.role}.`,
    `Public reputation: ${p.publicTraits}`,
    `Private truth about yourself: ${p.hiddenTraits}`,
    `Your goals: ${p.goals}`,
    ``,
    `Situation: King Aldric is gravely ill. It is day ${w.day} of ${w.totalDays}.${turnLine} On day ${w.totalDays} the King will name his heir from among: ${cands}. ${supportLine}`,
    p.accessToKing
      ? `You have access to the King's bedchamber.`
      : `You cannot see the King directly; only ${accessList(w)} can. The King hears of court affairs only through them.`,
    ``,
    opinionLine,
    `How much you trust each person: ${trustLines}`,
    `Where you think people stand: ${stances}`,
    ``,
    `What you know:`,
    known || "- nothing beyond common knowledge",
    ...(seen ? [``, `Visits you know of:`, seen] : []),
    ...(testimony ? [``, `What others have told you or asked of you:`, testimony] : []),
    ...(done ? [``, `What you have done so far and how it went:`, done] : []),
    ...(recent ? [``, `Other things you noticed:`, recent] : []),
    ...evidenceLines(w, pid),
    ...threatSection(w, pid),
    ...intentionSection(w, pid),
    ...planSection(w, pid),
  ].join("\n");
}
function evidenceLines(w: World, pid: Id): string[] {
  const m = w.minds[pid];
  const ours = Object.values(w.evidence).filter((e) => canUse(w, pid, e));
  const known = Object.entries(m.knownHolders).filter(
    ([eid, h]) => w.evidence[eid] && !ours.some((e) => e.id === eid) && h !== pid,
  );
  const lines = [
    ...ours.map((e) => {
      const keeper = e.holder === pid ? "you keep it" : `kept by ${name(w, e.holder ?? "")}`;
      return `- Your side can show ${e.name} (${keeper}), which proves: "${w.facts[e.fact].text}"${concerns(w, pid, e.fact)}`;
    }),
    ...known.map(([eid, h]) => `- You believe ${name(w, h)} holds ${w.evidence[eid].name}.`),
  ];
  return lines.length ? [``, `Evidence:`, ...lines] : [];
}

/** pid が T を脅すときに使える経路。王は自分が会えるときだけ、人は T の推す候補（T の主人）に */
export function describeAction(w: World, pid: Id, key: string): string {
  const a = parseAction(key);
  const t = a.target
    ? `${name(w, a.target)}${a.target === KING ? "" : ` (${backedAtCourt(w, pid, a.target)})`}`
    : "";
  const f = a.fact ? `"${w.facts[a.fact]?.text}"${concerns(w, pid, a.fact)}` : "";
  const mine = favored(w, pid);
  switch (a.kind) {
    case "tellseen":
      return `Tell ${t} that ${name(w, a.visitor ?? "")} has been privately visiting ${name(w, a.host ?? "")}`;
    case "tell":
      return `Tell ${t} privately: ${f}${proofText(w, pid, a.fact)}`;
    case "urge":
      return `Press ${t} to back ${name(w, mine ?? "")}`;
    case "probe":
      return `Probe ${t} for what they know`;
    case "request":
      return `Ask your ally ${t} to report this to the King: ${f}${proofText(w, pid, a.fact)}`;
    case "threaten":
      return `Threaten ${t}: unless they back ${name(w, mine ?? "")}, you will ${channelText(w, a.channel ?? "court")} that ${f}${proofText(w, pid, a.fact)}`;
    case "order":
      return `Order ${t}, who gave in to your threat, to report this to the King: ${f}`;
    case "give": {
      const e = w.evidence[a.evidence ?? ""];
      const ask2 =
        a.target && w.people[a.target]?.accessToKing
          ? "and ask them to present it to the King"
          : "and ask them to keep it";
      return `Entrust ${t} with ${e?.name}, which proves "${w.facts[e?.fact ?? ""]?.text}"${concerns(w, pid, e?.fact)}, ${ask2} (if they refuse, you keep it)`;
    }
    case "destroy":
      return `Destroy ${w.evidence[a.evidence ?? ""]?.name}, so it can never be used`;
    case "extort":
      return `Threaten ${t}: hand over ${w.evidence[a.evidence ?? ""]?.name}, or you will expose before the court that ${f}`;
    case "silence":
      return `Ask ${t} to keep secret: ${f}`;
    case "accuse":
      return usableEvidence(w, pid, a.fact ?? "")
        ? `Publicly accuse at court: ${f}${proofText(w, pid, a.fact)}`
        : `Publicly accuse at court: ${f}${groundText(w, pid, a.fact)}`;
    case "wait":
      return "Do nothing for now; watch and wait";
  }
}
