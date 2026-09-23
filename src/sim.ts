import {
  evidenceDefs,
  exposureEffects,
  facts,
  initialKnowledge,
  initialKnownHolders,
  initialKnownKnowers,
  initialSupport,
  initialTrust,
  KING,
  people,
  TOTAL_DAYS,
} from "./cast.ts";
import {
  argmax,
  ask,
  bool,
  choice,
  fmt,
  makeRng,
  type Probabilities,
  type Questions,
  sample,
  sampleFocused,
  score,
} from "./jev.ts";
import {
  initBeliefs,
  learnStance,
  type Meeting,
  perceivedLabel,
  perceivedSupport,
  recentSightings,
  recordSightings,
  sightingLine,
} from "./perception.ts";
import type {
  Allegiance,
  Event,
  Evidence,
  Id,
  Mind,
  Override,
  Testimony,
  Threat,
  ThreatChannel,
  World,
} from "./types.ts";

export const TURNS = 3;
const SUIT_LEVELS = ["unfit", "doubtful", "acceptable", "good", "the best choice"];
const CHANGE_LEVELS = ["much worse", "somewhat worse", "unchanged", "somewhat better", "much better"];
const TRUST_CHANGE = [
  "much less trust",
  "somewhat less trust",
  "unchanged",
  "somewhat more trust",
  "much more trust",
];

// state に渡すときの言葉。0..4 を 0.5 刻みの 9 段階にする。
// 5 段階に丸めると、1 回の反応で動く 0.2〜0.5 程度の変化が消えて Jev に届かない。
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

const clamp = (v: number) => Math.min(4, Math.max(0, v));
/** 王への訴え 1 回が王の候補評価に効く強さ。事実を聞いたとき（0.5）より小さい */
const URGE_WEIGHT = 0.2;
const uniq = <T>(xs: T[]) => [...new Set(xs)];

// ---- 世界の構築

export function buildWorld(): World {
  const w: World = {
    day: 0,
    turn: 0,
    totalDays: TOTAL_DAYS,
    // 王に会えるかは実行中に変わる（失脚など）ので、人物設定は世界ごとに複製する
    people: Object.fromEntries(people.map((p) => [p.id, { ...p }])),
    minds: {},
    facts: Object.fromEntries(facts.map((f) => [f.id, f])),
    events: [],
    kingSuitability: [],
    snapshots: [],
    publicFacts: [],
    pending: [],
    plans: [],
    threats: [],
    exposed: [],
    evidence: Object.fromEntries(evidenceDefs.map((e) => [e.id, { ...e }])),
  };
  for (const p of people) {
    const trust: Record<Id, number> = {};
    for (const q of people) if (q.id !== p.id) trust[q.id] = initialTrust[p.id]?.[q.id] ?? 2;
    const known = initialKnowledge[p.id] ?? [];
    // 知っていると分かっている人: 当事者 ＋ 初期設定で分かっている人
    const knownKnowers: Record<Id, Id[]> = {};
    for (const f of known) {
      knownKnowers[f] = uniq([...w.facts[f].parties, ...(initialKnownKnowers[p.id]?.[f] ?? [])]).filter(
        (x) => x !== p.id,
      );
    }
    w.minds[p.id] = {
      knowledge: known.map((factId) => ({ factId, belief: 1, source: "self", day: 0 })),
      trust,
      support: initialSupport[p.id] ?? "undecided",
      opinions: initialOpinions(p.id, initialSupport[p.id] ?? "undecided"),
      testimony: [],
      commitments: [],
      actionLog: [],
      knownKnowers,
      recent: [],
      allegiance: initialAllegiance(p.id, initialSupport[p.id] ?? "undecided"),
      sightings: [],
      beliefs: {},
      reports: [],
      reputations: {},
      // 持ち主は自分が持っている証拠を知っている。それ以外は人物設定に書いた範囲（initialKnownHolders）
      knownHolders: Object.fromEntries([
        ...evidenceDefs.filter((e) => e.holder === p.id).map((e) => [e.id, e.holder]),
        ...Object.entries(initialKnownHolders[p.id] ?? {}),
      ]),
    };
  }
  initBeliefs(w);
  takeSnapshot(w);
  return w;
}

function initialAllegiance(pid: Id, support: Mind["support"]): Allegiance {
  const p = people.find((x) => x.id === pid);
  if (p?.candidate || p?.advisorOf) return "sworn";
  return support === "undecided" ? "independent" : "leaning";
}

/** 候補本人は自分を最良、支持者は支持先を good、他は acceptable。王は初日の評価で決まる */
function initialOpinions(pid: Id, support: Mind["support"]): Record<Id, number> {
  if (pid === KING) return {};
  const o: Record<Id, number> = {};
  for (const c of people.filter((x) => x.candidate)) o[c.id] = c.id === pid ? 4 : c.id === support ? 3 : 2;
  return o;
}

function takeSnapshot(w: World) {
  const minds: World["snapshots"][number]["minds"] = {};
  for (const [id, m] of Object.entries(w.minds)) {
    minds[id] = {
      support: m.support,
      trust: { ...m.trust },
      knowledge: m.knowledge.map((k) => ({ ...k })),
      opinions: { ...m.opinions },
      knownKnowers: Object.fromEntries(Object.entries(m.knownKnowers).map(([k, v]) => [k, [...v]])),
      beliefs: Object.fromEntries(Object.entries(m.beliefs).map(([k, v]) => [k, { ...v }])),
      allegiance: m.allegiance,
    };
  }
  w.snapshots.push({ day: w.day, minds });
}

// ---- 小さな道具

export const candidates = (w: World) => Object.values(w.people).filter((p) => p.candidate);
const name = (w: World, id: Id) => w.people[id]?.name ?? id;

function addEvent(w: World, e: Omit<Event, "id" | "turn">): Event {
  const ev: Event = { id: w.events.length + 1, turn: w.turn, ...e };
  w.events.push(ev);
  return ev;
}

export function remember(w: World, pid: Id, text: string) {
  const r = w.minds[pid].recent;
  r.push(`Day ${w.day}: ${text}`);
  if (r.length > 8) r.shift();
}

function knows(m: Mind, factId: Id) {
  return m.knowledge.find((k) => k.factId === factId);
}

/** 話し手がその事実を知った出来事。元から知っていたなら無し */
function learnedFrom(w: World, speaker: Id, factId: Id): number[] {
  const k = knows(w.minds[speaker], factId);
  return k?.eventId === undefined ? [] : [k.eventId];
}

export function addKnowers(w: World, pid: Id, factId: Id, ids: (Id | "self" | undefined)[]) {
  const m = w.minds[pid];
  const cur = m.knownKnowers[factId] ?? [];
  m.knownKnowers[factId] = uniq([...cur, ...ids.filter((x): x is Id => !!x && x !== "self" && x !== pid)]);
}

/** pid が「この事実を知っている」と分かっている人。公の事実は王以外の全員 */
export function knownToKnow(w: World, pid: Id, factId: Id): Set<Id> {
  const s = new Set(w.minds[pid].knownKnowers[factId] ?? []);
  if (w.publicFacts.includes(factId)) for (const id of Object.keys(w.people)) if (id !== KING) s.add(id);
  return s;
}

const favored = (w: World, pid: Id): Id | undefined => {
  const s = w.minds[pid].support;
  return s === "undecided" ? undefined : s;
};

/** a から見て、b は同じ候補を推す味方か（a の推測による） */
export function sameSide(w: World, a: Id, b: Id): boolean {
  const fa = favored(w, a);
  return !!fa && fa === perceivedSupport(w, a, b);
}

/**
 * 陣営の構成員（頭目の計画に入る人）。頭目は自陣営の顔ぶれを知っている。
 * 脅されて支持を変えた人は、脅した側の陣営には入らない。
 */
export function factionOf(w: World, candidate: Id): Id[] {
  return Object.keys(w.people).filter(
    (id) => id !== KING && w.minds[id].support === candidate && w.minds[id].allegiance !== "coerced",
  );
}

/** pid から見て、自陣営の弱みになる事実か（暴かれて困る人に、自分か自陣営と思う人がいる） */
export function isOurSecret(w: World, pid: Id, factId: Id): boolean {
  const c = favored(w, pid);
  return w.facts[factId].harms.some(
    (p) => p === pid || (c !== undefined && (p === c || perceivedSupport(w, pid, p) === c)),
  );
}

/** observer から見た id の立場（全知ではなく、observer の推測） */
export function backedAtCourt(w: World, observer: Id, id: Id): string {
  return perceivedLabel(w, observer, id);
}

/** 事実が pid 自身か自陣営に関わるなら、その旨を書き添える。有利か不利かの判断は Jev に任せる */
function concerns(w: World, pid: Id, factId: Id | undefined): string {
  if (!factId) return "";
  if (w.facts[factId]?.harms.includes(pid)) return " (exposing this would hurt you yourself)";
  if (w.facts[factId]?.parties.includes(pid)) return " (this concerns you yourself)";
  if (isOurSecret(w, pid, factId)) return " (this concerns your own side)";
  return "";
}

/** pid の陣営の、その日の計画（恐れて従っている人には無い） */
function myPlan(w: World, pid: Id) {
  if (w.minds[pid].allegiance === "coerced") return undefined;
  return w.plans.find((p) => p.day === w.day && p.faction === favored(w, pid));
}

// ---- state の組み立て

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
function doneToday(w: World, pid: Id): Set<string> {
  return new Set(w.minds[pid].actionLog.filter((a) => a.day === w.day).map((a) => a.action));
}

/**
 * 今日の計画のうち、pid に割り当てられて、まだ実行していない一手。
 * 計画の一手は 1 回実行すれば済む。実行後も印が残ると、失敗した手を同じ日に繰り返す。
 */
function remainingPlanned(w: World, pid: Id) {
  const done = doneToday(w, pid);
  return myPlan(w, pid)?.moves.filter((m) => m.actor === pid && !done.has(m.action)) ?? [];
}

/** 個人の整理で決めた、今日の自分の手のうち未実行のもの */
function remainingIntended(w: World, pid: Id) {
  const it = w.minds[pid].intention;
  if (!it || it.day !== w.day) return [];
  const done = doneToday(w, pid);
  return it.moves.filter((m) => !done.has(m.action));
}

/** 引き受けた依頼のうち、まだ実行していないもの */
function pendingOf(w: World, pid: Id) {
  return w.pending.filter((x) => x.actor === pid);
}

/** 今王に会える人（失脚や取り立てで変わる） */
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

function channelText(w: World, c: ThreatChannel): string {
  if (c === "king") return "tell the King";
  if (c === "court") return "expose it before the whole court";
  return `tell ${name(w, c)}`;
}

/** 脅しの経路ごとの、実行にあたる行動の鍵 */
function carryOutKey(t: Threat): string {
  if (t.channel === "court") return `accuse:${t.fact}`;
  if (t.channel === "king") return `tell:${KING}:${t.fact}`;
  return `tell:${t.channel}:${t.fact}`;
}

/**
 * 告発の下地: 王以外で、この話を聞いたと分かっている人の数。
 * 裏付けのない告発は、初めて聞く人にはほぼ信じられない（実測で約 0.3）。
 * 複数の口から聞いていると約 0.6 まで上がるので、下地の有無を告発する人に見せる。
 */
/** 選択肢の文面に添える、示せる証拠。選ぶ時点で「この手なら証拠を示せる」と分かるように */
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
function exposureText(factId: Id): string {
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

// ---- 行動
// 行動は「相手と話題の組」を 1 つの鍵で表す。Jev にはこの組を 1 回の Choice で選ばせる。
// 別々に問うと、Jev の問いは互いを参照しないので、組み合わせの価値を判断できない。
//   tell:T:F      T に事実 F を伝える
//   urge:T        T に自分の推す候補の支持を迫る
//   probe:T       T を探る
//   request:T:F   味方 T に F を伝え、王への報告を頼む
//   threaten:T:F:C  F の当事者 T を、F を材料に脅して支持させる。拒まれたら経路 C で暴く
//                   （C = king 王に伝える / court 宮廷で告発する / 人の id その人に伝える）
//   order:T:F     脅しに屈した T に、F を王へ報告するよう命じる
//   silence:T:F   F を知っている T に口止めする
//   accuse:F      宮廷で F を公に告発する
//   tellseen:T:V:H  T に「V が H を訪ねていた」と伝える
//   wait          何もしない

export type ActionKind =
  | "tell"
  | "urge"
  | "probe"
  | "request"
  | "threaten"
  | "order"
  | "silence"
  | "accuse"
  | "tellseen"
  | "give"
  | "destroy"
  | "extort"
  | "wait";

export interface Action {
  kind: ActionKind;
  /** 証拠を扱う行動（give / destroy / extort）の証拠 */
  evidence?: Id;
  target?: Id;
  fact?: Id;
  visitor?: Id;
  host?: Id;
  channel?: ThreatChannel;
}

export function parseAction(key: string): Action {
  const [kind, a, b, c] = key.split(":") as [ActionKind, string?, string?, string?];
  if (kind === "accuse") return { kind, fact: a };
  if (kind === "tellseen") return { kind, target: a, visitor: b, host: c };
  if (kind === "threaten") return { kind, target: a, fact: b, channel: c };
  if (kind === "give") return { kind, target: a, evidence: b };
  if (kind === "destroy") return { kind, evidence: a };
  if (kind === "extort") return { kind, target: a, fact: b, evidence: c };
  return { kind, target: a, fact: b };
}

// ---- 証拠
// 示せば聞き手は強く信じる（下限 EVIDENCE_FLOOR）。文面に添えるだけでは +0.1 しか効かなかったため、コード側で下限を持たせる。
// 偽造を入れる段階で見直す。

const EVIDENCE_FLOOR = 0.85;

/**
 * 同じ陣営の構成員か（同じ候補を支持し、どちらも脅されて寝返った人ではない）。
 * 証拠を使う権利は陣営のもの。どこにも属さない人と、脅されて寝返った人は、自分の持つ証拠だけを使える
 */
function sameFaction(w: World, a: Id, b: Id): boolean {
  if (a === b) return true;
  const c = w.minds[a].support;
  if (c === "undecided") return false;
  const members = factionOf(w, c);
  return members.includes(a) && members.includes(b);
}

/**
 * pid が示せる証拠か。自分が預かっているか、仲間が預かっていると知っていて、その事実も知っているもの。
 * 保管（誰が物を持つか）は個人、使う権利は陣営。ただし仲間の証拠を使えるのは、預かり手から知らされたときだけ
 * （仲間にも隠している証拠がある。例: Orlin は Isolde への保険として支払いの記録を隠している）
 */
function canUse(w: World, pid: Id, e: Evidence): boolean {
  if (e.holder === undefined) return false;
  if (!knows(w.minds[pid], e.fact)) return false;
  if (e.holder === pid) return true;
  return sameFaction(w, pid, e.holder) && w.minds[pid].knownHolders[e.id] === e.holder;
}

function usableEvidence(w: World, pid: Id, factId: Id): Evidence | undefined {
  return Object.values(w.evidence).find((e) => e.fact === factId && canUse(w, pid, e));
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
function threatChannels(w: World, pid: Id, t: Id, f: Id): ThreatChannel[] {
  const aware = knownToKnow(w, pid, f);
  const out: ThreatChannel[] = ["court"];
  if (w.people[pid].accessToKing && !aware.has(KING)) out.push("king");
  const patron = perceivedSupport(w, pid, t);
  // 当事者はもともと知っているので、その人に暴くと脅しても意味がない
  if (
    patron !== "unknown" &&
    patron !== "undecided" &&
    patron !== pid &&
    !aware.has(patron) &&
    !w.facts[f].parties.includes(patron)
  )
    out.push(patron);
  return out;
}

const canMeet = (w: World, pid: Id, t: Id) => t !== pid && (t !== KING || w.people[pid].accessToKing);

/** pid が今とれる行動。意味のない組（既に知っていると分かっている相手に話す等）は最初から除く */
export function enumerateActions(w: World, pid: Id): string[] {
  const m = w.minds[pid];
  const others = Object.keys(w.people).filter((t) => canMeet(w, pid, t));
  const mine = favored(w, pid);
  const keys: string[] = [];
  for (const k of m.knowledge) {
    const f = k.factId;
    const aware = knownToKnow(w, pid, f);
    const isPublic = w.publicFacts.includes(f);
    for (const t of others) if (!aware.has(t)) keys.push(`tell:${t}:${f}`);
    if (!isPublic) keys.push(`accuse:${f}`);
    const asked = (kind: "request" | "silence", t?: Id) =>
      m.commitments.some(
        (c) => c.kind === kind && c.fact === f && c.agreed && (t === undefined || c.to === t),
      );
    for (const t of others) {
      if (t === KING) continue;
      // 依頼: 王に会える味方に、王がまだ知らない事実の報告を頼む。引き受けてもらえた依頼は繰り返さない
      if (w.people[t].accessToKing && sameSide(w, pid, t) && !aware.has(KING) && !asked("request"))
        keys.push(`request:${t}:${f}`);
      // 脅し: 暴かれて困る人で、味方でも候補本人でもない相手（当事者でも、困らない事実では脅せない）
      if (
        mine &&
        !isPublic &&
        w.facts[f].harms.includes(t) &&
        !sameSide(w, pid, t) &&
        !w.people[t].candidate &&
        !w.threats.some((x) => x.from === pid && x.to === t && x.fact === f)
      )
        for (const c of threatChannels(w, pid, t, f)) keys.push(`threaten:${t}:${f}:${c}`);
      // 命令: 自分の脅しに屈した相手に、王への報告を命じる
      if (w.minds[t].coercedBy?.by === pid && w.people[t].accessToKing && !aware.has(KING))
        keys.push(`order:${t}:${f}`);
      // 口止め: 自陣営の弱みを知っていると分かっている相手。候補本人と、既に約束した相手は除く
      if (
        !isPublic &&
        isOurSecret(w, pid, f) &&
        aware.has(t) &&
        !w.people[t].candidate &&
        !asked("silence", t)
      )
        keys.push(`silence:${t}:${f}`);
    }
  }
  for (const t of others) {
    keys.push(`probe:${t}`);
    // 王への説得は、王に会える人だけ（others が既に絞っている）。王は支持を持たない。
    // 相手の支持は本人の推測で判断する（既に味方だと思っている相手には迫らない）
    if (mine && !w.people[t].candidate && (t === KING || perceivedSupport(w, pid, t) !== mine))
      keys.push(`urge:${t}`);
  }
  // 目撃を伝える: 最近の目撃 3 件まで。当事者と、既に伝えた相手は除く
  const told = new Set(m.actionLog.map((a) => a.action));
  for (const s of recentSightings(w, pid, 3, 3)) {
    for (const t of others) {
      if (t === s.visitor || t === s.host) continue;
      const key = `tellseen:${t}:${s.visitor}:${s.host}`;
      if (!told.has(key)) keys.push(key);
    }
  }
  // 証拠: 渡す（王以外）、処分する（自陣営の弱みか、自分が困るもの）、脅して奪う
  for (const e of Object.values(w.evidence)) {
    if (e.holder === pid) {
      // 渡すのは陣営の外へだけ（陣営の中では誰が預かっていても使えるので、持ち替えに意味がない）
      for (const t of others) if (t !== KING && !sameFaction(w, pid, t)) keys.push(`give:${t}:${e.id}`);
      if (isOurSecret(w, pid, e.fact)) keys.push(`destroy:${e.id}`);
      continue;
    }
    // 持ち主だと思っている相手が、自分の知っている秘密で困るなら「渡さなければ暴く」と脅せる
    const holder = m.knownHolders[e.id];
    if (!holder || holder === pid || !others.includes(holder) || w.people[holder].candidate) continue;
    if (sameSide(w, pid, holder)) continue; // 味方の証拠は脅して奪わない（渡してもらえばよい）
    if (w.threats.some((x) => x.from === pid && x.to === holder && x.demandEvidence === e.id)) continue;
    for (const k of m.knowledge)
      if (w.facts[k.factId].harms.includes(holder) && !w.publicFacts.includes(k.factId))
        keys.push(`extort:${holder}:${k.factId}:${e.id}`);
  }
  // 拒まれた脅しの実行と、脅し返しの報復。通常の条件で除かれていても選べるようにする
  for (const t of w.threats) if (t.from === pid && t.status === "refused") keys.push(carryOutKey(t));
  keys.push("wait");
  return uniq(keys);
}

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

// ---- 介入

function overrideOf(w: World, actor: Id, field: Override["field"]): string | undefined {
  return w.meta?.overrides?.find(
    (o) => o.day === w.day && o.actor === actor && o.field === field && (o.turn ?? 1) === w.turn,
  )?.value;
}

// ---- 1 ターン

interface TurnChoice {
  actor: Id;
  action: string;
  support?: Mind["support"];
  raw: Record<string, Probabilities>;
  /** 引き受けた依頼の実行なら、その依頼の出来事 */
  fromRequest?: number;
  overridden?: boolean;
  interventionId?: number;
}

function supportCriteria(w: World): Record<string, string> {
  const c: Record<string, string> = Object.fromEntries(candidates(w).map((x) => [x.id, x.name]));
  c.undecided = "Commit to nobody yet";
  return c;
}

async function chooseAction(w: World, pid: Id, askSupport = true): Promise<TurnChoice> {
  const p = w.people[pid];
  // 選択肢の印は 3 種類。どれに従うかは、本人の state をもとに Jev が決める。
  // 引き受けた依頼も強制はしない（実行の時点で考え直せるように）
  const planned = new Set(remainingPlanned(w, pid).map((m) => m.action));
  const intended = new Set(remainingIntended(w, pid).map((m) => m.action));
  const promised = new Map(pendingOf(w, pid).map((x) => [x.action, x]));
  // 拒まれた脅しの実行（期限つき）
  const carry = new Map(
    w.threats.filter((t) => t.from === pid && t.status === "refused").map((t) => [carryOutKey(t), t]),
  );
  const keys = uniq([...enumerateActions(w, pid), ...promised.keys(), ...carry.keys()]);
  const promiseMark = (k: string) => {
    const x = promised.get(k);
    if (!x) return "";
    return x.kind === "order"
      ? ` [demanded by ${name(w, x.from)}, who holds your secret]`
      : ` [you promised ${name(w, x.from)} to do this]`;
  };
  const marks = (k: string) =>
    [
      intended.has(k) ? " [your own intention]" : "",
      planned.has(k) ? " [your faction's instruction]" : "",
      promiseMark(k),
      carry.has(k) ? ` [carry out your threat against ${name(w, carry.get(k)?.to ?? "")}]` : "",
    ].join("");
  const criteria = Object.fromEntries(keys.map((k) => [k, `${describeAction(w, pid, k)}${marks(k)}`]));
  const questions: Questions = {
    action: {
      type: "choice",
      instructions: `What does ${p.name} do now, to best advance their goals? Choose whom to approach and what to say together.`,
      criteria,
    },
  };
  // 恐れて従っている人には支持を問い直さない（屈したら、その支持に移ったまま）
  if (askSupport && w.turn === 1 && !p.candidate && w.minds[pid].allegiance !== "coerced") {
    questions.support = {
      type: "choice",
      instructions: `Given everything ${p.name} knows and wants, which candidate do they now genuinely favor for the throne?`,
      criteria: supportCriteria(w),
    };
  }
  const a = await ask(describe(w, pid), questions);
  const dist = choice(a.action);
  const c: TurnChoice = {
    actor: pid,
    action: sampleFocused(dist, makeRng(`${pid}:${w.day}:${w.turn}`)),
    raw: { action: dist },
  };
  c.fromRequest = promised.get(c.action)?.requestEventId;
  if (questions.support) {
    c.raw.support = choice(a.support);
    c.support = argmax(c.raw.support) as Mind["support"];
  }
  const oa = overrideOf(w, pid, "action");
  const os = overrideOf(w, pid, "support");
  if (oa !== undefined) c.action = oa;
  if (os !== undefined) c.support = os as Mind["support"];
  c.overridden = oa !== undefined || os !== undefined;
  return c;
}

export async function runTurn(w: World) {
  const actors = Object.keys(w.people).filter((id) => id !== KING);
  const choices = await Promise.all(actors.map((pid) => chooseAction(w, pid)));
  const supportBefore = new Map(actors.map((pid) => [pid, w.minds[pid].support]));
  // 介入・支持の更新は、決まった順で記録する
  for (const c of choices) {
    if (c.overridden) {
      c.interventionId = addEvent(w, {
        day: w.day,
        actor: c.actor,
        kind: "intervene",
        text: `介入: ${name(w, c.actor)} の行動/支持を固定（${c.action} / ${c.support ?? "-"}）`,
        causes: [],
      }).id;
    }
    if (c.support !== undefined)
      setSupport(w, c.actor, c.support, c.raw.support ?? {}, c.interventionId ? [c.interventionId] : []);
  }
  // ターンの始めに支持が変わった人は、新しい立場で行動を選び直す。
  // 古い立場で選んだ手（前の陣営の計画など）を、新しい立場のまま実行しないように
  const switched = choices.filter(
    (c) => !c.overridden && w.minds[c.actor].support !== supportBefore.get(c.actor),
  );
  const redone = await Promise.all(switched.map((c) => chooseAction(w, c.actor, false)));
  for (const r of redone) {
    const i = choices.findIndex((c) => c.actor === r.actor);
    choices[i] = { ...r, support: choices[i].support, raw: { ...choices[i].raw, ...r.raw } };
  }
  // 依頼の消化は、選び直したあとの行動で判定する
  for (const c of choices)
    if (c.fromRequest !== undefined) w.pending = w.pending.filter((x) => x.requestEventId !== c.fromRequest);
  const applies = await Promise.all(choices.map((c) => resolve(w, c)));
  for (const apply of applies) apply();
  // 見張る人が、このターンの訪問を記録する（中身は見えない）
  const meetings: Meeting[] = choices.flatMap((c) => {
    const a = parseAction(c.action);
    return a.target && a.kind !== "accuse" && a.kind !== "wait" ? [{ visitor: c.actor, host: a.target }] : [];
  });
  recordSightings(w, meetings);
}

export function startDay(w: World) {
  w.day++;
  w.turn = 0;
}

export async function endDay(w: World) {
  w.turn = 0;
  await kingAssess(w);
  // 引き受けた依頼は、翌日の終わりまでに果たさなければ失効する
  w.pending = w.pending.filter((x) => x.day >= w.day);
  lapseThreats(w);
}

/** 日の終わりの状態を残す。個人の整理（推測の更新）のあとに呼ぶ */
export function closeDay(w: World) {
  takeSnapshot(w);
}

// ---- 反応の解決
// そのターンの反応はすべて、ターン開始時の同じ世界から state を作って並列に Jev に問う（ask 段）。
// 世界への書き戻しは決まった順番で行う（apply 段）。これで並列でも結果が決定的になる。
// 同じターンの中の連鎖は起きず、次のターンに持ち越される。

/** 書き戻しを行い、行動した人から見えた反応を返す（行動の記録に残す） */
type Apply = (cause: Event) => string | undefined;

function adjustTrust(w: World, listener: Id, speaker: Id, levelScore: number): number {
  const lm = w.minds[listener];
  const delta = (levelScore - 2) * 0.5;
  lm.trust[speaker] = clamp(lm.trust[speaker] + delta);
  return delta;
}

const yes = (p: number, seed: string) => makeRng(seed)() < p;

/**
 * 聞き手が事実を信じるか、話し手への信頼、各候補の評価がどう動くか。
 * 候補の評価は「真だとしたら」で問い、信じる確率で重み付けする（1 回の呼び出しに収めるため）。
 * 出所も伝わる: 話し手が誰から聞いたか。
 */
async function askFact(
  w: World,
  speaker: Id,
  listener: Id,
  factId: Id,
  mode: "private" | "public" = "private",
): Promise<Apply> {
  const f = w.facts[factId];
  const alreadyAtAsk = Boolean(knows(w.minds[listener], factId));
  const listenerName = name(w, listener);
  const via = knows(w.minds[speaker], factId)?.source ?? "self";
  const viaText =
    via === "self" ? "They claim to know it firsthand." : `They say they had it from ${name(w, via)}.`;
  // 話し手がこの事実の証拠を持っていれば、示したことになる
  const shown = usableEvidence(w, speaker, factId);
  const proof = shown
    ? ` They showed ${mode === "public" ? "the court" : "you"} ${shown.name} as proof.`
    : "";
  const opener =
    mode === "public"
      ? `Just now, before the assembled court, ${name(w, speaker)} publicly accused: "${f.text}"${proof}`
      : `Just now, ${name(w, speaker)} told you in private: "${f.text}" ${viaText}${proof}`;
  const state = `${describe(w, listener)}\n\n${opener}${alreadyAtAsk ? " You had already heard something like this." : ""}`;
  const questions: Questions = {
    believe: { type: "boolean", instructions: `Does ${listenerName} believe this claim is true?` },
    trust_change: {
      type: "score",
      instructions: `After this, how does ${listenerName}'s trust in ${name(w, speaker)} change?`,
      criteria: TRUST_CHANGE,
    },
  };
  if (!alreadyAtAsk) {
    for (const c of candidates(w)) {
      questions[`view_${c.id}`] = {
        type: "score",
        instructions: `If this claim is true, how does it change ${listenerName}'s view of ${c.name} as a future king?`,
        criteria: CHANGE_LEVELS,
      };
    }
  }
  const a = await ask(state, questions);

  return (cause) => {
    const lm = w.minds[listener];
    // 証拠を見た人は強く信じる。見た人は、話し手が持ち主だと知る
    const belief = shown ? Math.max(bool(a.believe), EVIDENCE_FLOOR) : bool(a.believe);
    // 見た人は、見せた人が持っていると思う。ただし自分が預かり手か、本当の預かり手を既に知っているなら上書きしない
    if (shown && shown.holder !== listener && lm.knownHolders[shown.id] !== shown.holder)
      lm.knownHolders[shown.id] = speaker;
    const seen = `${listenerName} ${belief >= 0.5 ? "seemed to believe it" : "seemed doubtful"}`;
    const already = knows(lm, factId);
    const learned: Mind["knowledge"][number] = { factId, belief, source: speaker, via, day: w.day };
    if (already) {
      if (already.source !== "self") already.belief = Math.max(already.belief, belief);
    } else {
      lm.knowledge.push(learned);
    }
    // 当事者は知っているはず、という規則は、途中で知った事実にも適用する
    addKnowers(w, listener, factId, [speaker, via, ...f.parties]);
    addKnowers(w, speaker, factId, [listener]);
    const trustDelta = adjustTrust(w, listener, speaker, score(a.trust_change).score);
    lm.testimony.push({
      day: w.day,
      from: speaker,
      kind: mode === "public" ? "accusation" : "claim",
      about: factId,
      eventId: cause.id,
    });
    const hear = addEvent(w, {
      day: w.day,
      actor: listener,
      kind: "hear",
      target: speaker,
      factId,
      text: `${listenerName} は ${name(w, speaker)} から${mode === "public" ? "公の告発で" : ""}「${f.text}」と聞き、${belief >= 0.5 ? "信じた" : "疑った"}（信じる確率 ${belief.toFixed(2)}）`,
      causes: [cause.id, ...learnedFrom(w, speaker, factId)],
      data: { belief, trustDelta, via },
    });
    if (!already) learned.eventId = hear.id;
    // 王が信じたら、秘密は暴かれたことになる（事実ごとの結果が起きる）
    if (listener === KING && belief >= 0.5) applyExposure(w, factId, hear);
    if (already || alreadyAtAsk) return seen;

    const deltas: Record<Id, number> = {};
    for (const c of candidates(w)) {
      deltas[c.id] = (score(a[`view_${c.id}`]).score - 2) * 0.5 * belief;
      lm.opinions[c.id] = clamp((lm.opinions[c.id] ?? 2) + deltas[c.id]);
    }
    const moved = Object.entries(deltas).filter(([, d]) => Math.abs(d) >= 0.2);
    if (moved.length) {
      addEvent(w, {
        day: w.day,
        actor: listener,
        kind: "reassess",
        text: `${listenerName} の候補評価が動いた: ${moved.map(([c, d]) => `${name(w, c)} ${d > 0 ? "+" : ""}${d.toFixed(2)}`).join(" / ")}`,
        causes: [hear.id],
        data: deltas,
      });
    }
    return seen;
  };
}

/** 支持を迫られた相手は、その場で支持を考え直す */
async function askUrge(w: World, speaker: Id, listener: Id, cand: Id): Promise<Apply> {
  const listenerName = name(w, listener);
  const state = `${describe(w, listener)}\n\nJust now, ${name(w, speaker)} urged you in private to back ${name(w, cand)} for the throne.`;
  const questions: Questions = {
    trust_change: {
      type: "score",
      instructions: `After this, how does ${listenerName}'s trust in ${name(w, speaker)} change?`,
      criteria: TRUST_CHANGE,
    },
  };
  // 恐れて従っている人は、説得では支持を変えない
  const canSwitch =
    !w.people[listener].candidate && listener !== KING && w.minds[listener].allegiance !== "coerced";
  if (listener === KING) {
    // 王は支持を持たない。代わりに、この訴えで候補の見方がどう変わったかを問い、
    // それを王の評価に小さく反映する。説得した人に見える素振りも、この答えから出す。
    // （素振りを独立に問うと、評価が下がり続けていても「動いた」と返り、偽の手応えになる）
    questions.view = {
      type: "score",
      instructions: `How does this plea change the King's view of ${name(w, cand)} as heir?`,
      criteria: CHANGE_LEVELS,
    };
  }
  if (canSwitch) {
    questions.support = {
      type: "choice",
      instructions: `After this conversation, which candidate does ${listenerName} now genuinely favor?`,
      criteria: supportCriteria(w),
    };
  }
  const a = await ask(state, questions);
  return (urge) => {
    adjustTrust(w, listener, speaker, score(a.trust_change).score);
    w.minds[listener].testimony.push({
      day: w.day,
      from: speaker,
      kind: "urge",
      about: cand,
      eventId: urge.id,
    });
    // 説得されると、話し手の支持先が確実に分かる
    learnStance(w, listener, speaker, cand, `urged you to back ${name(w, cand)}`);
    if (listener === KING) {
      // 事実を聞いたときより小さく効かせる（中身のない訴えなので）
      const delta = (score(a.view).score - 2) * URGE_WEIGHT;
      const km = w.minds[KING];
      km.opinions[cand] = clamp((km.opinions[cand] ?? 2) + delta);
      if (Math.abs(delta) >= 0.05) {
        addEvent(w, {
          day: w.day,
          actor: KING,
          kind: "reassess",
          text: `王の ${name(w, cand)} への評価が訴えで動いた: ${delta > 0 ? "+" : ""}${delta.toFixed(2)}`,
          causes: [urge.id],
          data: { [cand]: delta },
        });
      }
      if (delta >= 0.05) return "The King seemed moved";
      if (delta <= -0.05) return "The King seemed displeased";
      return "The King gave no sign of being moved";
    }
    if (!canSwitch) return `${listenerName} listened`;
    const after = argmax(choice(a.support)) as Mind["support"];
    setSupport(w, listener, after, choice(a.support), [urge.id]);
    return after === cand
      ? `${listenerName} came round to ${name(w, cand)}`
      : `${listenerName} was not swayed`;
  };
}

/**
 * 支持を書き換える。1 人の支持が変わるのは 1 ターンに 1 回まで。
 * 同じターンの反応はどれも同じ世界から問うので、複数の説得や脅しが重なると、書き戻すたびに支持が行き来してしまう。
 * 決まった順で先に書き戻された変化を優先する。
 */
function setSupport(w: World, pid: Id, after: Mind["support"], dist: Probabilities, causes: number[]) {
  const before = w.minds[pid].support;
  if (before === after) return;
  if (w.events.some((e) => e.kind === "switch" && e.actor === pid && e.day === w.day && e.turn === w.turn))
    return;
  const m = w.minds[pid];
  m.support = after;
  if (m.allegiance !== "sworn" && m.allegiance !== "coerced")
    m.allegiance = after === "undecided" ? "independent" : "leaning";
  addEvent(w, {
    day: w.day,
    actor: pid,
    kind: "switch",
    target: after === "undecided" ? undefined : after,
    text: `${name(w, pid)} の支持が ${name(w, before)} から ${name(w, after)} に変わった [${fmt(dist)}]`,
    causes,
    data: dist,
  });
}

/** 問われた相手が何を漏らすか。漏らしたら、問うた側がそれを聞く（出所つき） */
async function askProbe(w: World, asker: Id, target: Id): Promise<Apply> {
  const tm = w.minds[target];
  const askerName = name(w, asker);
  const tellCriteria: Record<string, string> = Object.fromEntries(
    tm.knowledge.map((k) => [k.factId, w.facts[k.factId].text]),
  );
  tellCriteria.none = "Reveal nothing";
  const a = await ask(
    `${describe(w, target)}\n\nJust now, ${askerName} (${backedAtCourt(w, target, asker)}) is pressing you privately for what you know about the succession.`,
    {
      tell: {
        type: "choice",
        instructions: `What does ${name(w, target)} let slip to ${askerName}, if anything?`,
        criteria: tellCriteria,
      },
    },
  );
  const dist = choice(a.tell);
  const told = sampleFocused(dist, makeRng(`${target}:${w.day}:${w.turn}:probe:${asker}`));
  if (told === "none") {
    return (meet) => {
      remember(w, target, `${askerName} pressed you for information.`);
      addEvent(w, {
        day: w.day,
        actor: target,
        kind: "silent",
        target: asker,
        text: `${name(w, target)} は ${askerName} に何も明かさなかった`,
        causes: [meet.id],
        data: dist,
      });
      return `${name(w, target)} revealed nothing`;
    };
  }
  const hear = await askFact(w, target, asker, told);
  return (meet) => {
    remember(w, target, `${askerName} pressed you for information.`);
    const slip = addEvent(w, {
      day: w.day,
      actor: target,
      kind: "slip",
      target: asker,
      factId: told,
      text: `${name(w, target)} は問われて ${askerName} に漏らした`,
      causes: [meet.id],
      data: dist,
    });
    hear(slip);
    return `${name(w, target)} let slip: "${w.facts[told].text}"`;
  };
}

/** 依頼: 味方に事実を伝え、王への報告を頼む。引き受けたら次のターンに実行する */
async function askRequest(w: World, from: Id, to: Id, factId: Id): Promise<Apply> {
  const toName = name(w, to);
  const f = w.facts[factId];
  // 頼まれた事実が自分や自陣営に関わるなら、問いの文面で明記する（自分の秘密を王に報告させられないように）
  const state = `${describe(w, to)}\n\nJust now, ${name(w, from)} told you in private: "${f.text}"${concerns(w, to, factId)} and asked you to report it to the King at your next audience.`;
  const [hear, a] = await Promise.all([
    askFact(w, from, to, factId),
    ask(state, {
      agree: { type: "boolean", instructions: `Does ${toName} agree to report this to the King?` },
    }),
  ]);
  const p = bool(a.agree);
  const agreed = yes(p, `${to}:${w.day}:${w.turn}:request`);
  return (meet) => {
    const req = addEvent(w, {
      day: w.day,
      actor: from,
      kind: "request",
      target: to,
      factId,
      text: `${name(w, from)} は ${toName} に王への報告を頼み、${agreed ? "引き受けられた" : "断られた"}（引き受ける確率 ${p.toFixed(2)}）`,
      causes: [meet.id],
      data: { agree: p },
    });
    hear(req);
    w.minds[to].testimony.push({ day: w.day, from, kind: "request", about: factId, agreed, eventId: req.id });
    w.minds[from].commitments.push({ day: w.day, kind: "request", to, fact: factId, agreed });
    if (agreed)
      w.pending.push({
        actor: to,
        action: `tell:${KING}:${factId}`,
        requestEventId: req.id,
        from,
        day: w.day,
      });
    return `${toName} ${agreed ? "agreed" : "refused"} to report it to the King`;
  };
}

/** leader: pid の陣営の頭目（助けを求める相手）。頭目本人、属さない人、恐れて従っている人には無い */
function leaderFor(w: World, pid: Id): Id | undefined {
  const c = w.minds[pid].support;
  if (c === "undecided" || !factionOf(w, c).includes(pid)) return undefined;
  const lead = Object.values(w.people).find((p) => p.advisorOf === c)?.id;
  return lead && lead !== pid ? lead : undefined;
}

/**
 * 脅し返しに使える事実: to が知っていて、from か from の陣営（to の推測）が当事者で、まだ公でないもの。
 * 脅された事実そのものは除く（同じ秘密で脅し返しても意味がない）
 */
function counterFacts(w: World, to: Id, from: Id, threatened: Id): Id[] {
  const side = perceivedSupport(w, to, from);
  return w.minds[to].knowledge
    .map((k) => k.factId)
    .filter(
      (f) =>
        f !== threatened &&
        !w.publicFacts.includes(f) &&
        w.facts[f].harms.some(
          (p) => p === from || (side !== "unknown" && (p === side || perceivedSupport(w, to, p) === side)),
        ),
    );
}

/**
 * 脅し: 当事者に「支持しなければ、この経路で暴く」と迫る。
 * 標的の応じ方は 4 つ。屈する／拒む／脅し返す（相手側の秘密を知っているとき）／頭目に助けを求める（陣営に属するとき）。
 * 標的は、暴かれたら何が起きるか、脅した人が過去に脅しを実行したか、を材料に判断する。
 */
async function askThreat(
  w: World,
  from: Id,
  to: Id,
  factId: Id,
  cand: Id,
  channel: ThreatChannel,
  /** 証拠を渡せという脅しなら、その証拠（支持の代わりに要求する） */
  demandEvidence?: Id,
): Promise<Apply> {
  const toName = name(w, to);
  const fromName = name(w, from);
  const f = w.facts[factId];
  const demanded = demandEvidence ? w.evidence[demandEvidence] : undefined;
  const demandText = demanded ? `hand over ${demanded.name}` : `back ${name(w, cand)} for the throne`;
  // 脅す側が証拠を持っていれば、暴露は本物に見える
  const threatProof = usableEvidence(w, from, factId);
  const proofText = threatProof ? ` They hold ${threatProof.name} to prove it.` : "";
  const rep = w.minds[to].reputations[from];
  const repText = rep
    ? ` As far as you know, ${fromName} has carried out ${rep.kept} threat(s) and let ${rep.lapsed} lapse.`
    : ` You do not know whether ${fromName} carries out threats.`;
  const counters = counterFacts(w, to, from, factId);
  const lead = leaderFor(w, to);
  const state = `${describe(w, to)}\n\nJust now, ${fromName} told you privately that they know: "${f.text}" and threatened to ${channelText(w, channel)} unless you ${demandText}.${proofText}${exposureText(factId)}${repText}`;
  const responses: Record<string, string> = {
    comply: demanded ? `Give in and hand over ${demanded.name}` : `Give in and back ${name(w, cand)}`,
    refuse: `Refuse and defy ${fromName}, and risk exposure`,
  };
  if (counters.length)
    responses.counter = `Threaten back: you know "${w.facts[counters[0]].text}", which would hurt ${fromName}'s side`;
  if (lead)
    responses.seek_help = `Refuse, and go to ${name(w, lead)} for protection (revealing your secret to them)`;
  const a = await ask(state, {
    respond: {
      type: "choice",
      instructions: `How does ${toName} respond to this threat?`,
      criteria: responses,
    },
    trust_change: {
      type: "score",
      instructions: `After this, how does ${toName}'s trust in ${fromName} change?`,
      criteria: TRUST_CHANGE,
    },
  });
  const dist = choice(a.respond);
  const response = sample(dist, makeRng(`${to}:${w.day}:${w.turn}:threat`));
  return (meet) => {
    const label = {
      comply: "屈服させた",
      refuse: "拒まれた",
      counter: "脅し返された",
      seek_help: "拒まれ、相手は頭目に助けを求めた",
    }[response];
    const ev = addEvent(w, {
      day: w.day,
      actor: from,
      kind: "threaten",
      target: to,
      factId,
      text: `${fromName} は ${toName} を「${f.text}」で脅し（${demanded ? `${demanded.name}を渡せ、` : ""}${channelText(w, channel)}と）、${label} [${fmt(dist)}]`,
      causes: [meet.id],
      data: { dist, channel, demandEvidence },
    });
    adjustTrust(w, to, from, score(a.trust_change).score);
    addKnowers(w, to, factId, [from]);
    const complied = response === "comply";
    w.minds[to].testimony.push({
      day: w.day,
      from,
      kind: "threat",
      about: factId,
      candidate: cand,
      agreed: complied,
      eventId: ev.id,
    });
    const threat: Threat = {
      id: ev.id,
      day: w.day,
      from,
      to,
      fact: factId,
      candidate: cand,
      demandEvidence,
      channel,
      // 宮廷での告発は下地を作る時間が要るので、期限を 2 日にする
      deadline: w.day + (channel === "court" ? 2 : 1),
      status: complied ? "complied" : "refused",
    };
    w.threats.push(threat);
    if (complied && demanded) {
      // 証拠を渡せという脅しに屈したら、証拠が脅した側に移る（支持は変わらない）
      demanded.holder = from;
      w.minds[from].knownHolders[demanded.id] = from;
      w.minds[to].knownHolders[demanded.id] = from;
      addEvent(w, {
        day: w.day,
        actor: to,
        kind: "evidence_moved",
        target: from,
        text: `${toName} は脅しに屈して ${demanded.name} を ${fromName} に渡した`,
        causes: [ev.id],
      });
      return `${toName} gave in and handed over ${demanded.name}`;
    }
    if (complied) {
      // 屈したら支持が移り、以後は問い直さない。脅した側の陣営の計画には入らない
      const tm = w.minds[to];
      tm.allegiance = "coerced";
      tm.coercedBy = { by: from, fact: factId, day: w.day, previousSupport: tm.support };
      if (tm.support !== cand) {
        const before = tm.support;
        tm.support = cand;
        addEvent(w, {
          day: w.day,
          actor: to,
          kind: "switch",
          target: cand,
          text: `${toName} の支持が脅しで ${name(w, before)} から ${name(w, cand)} に変わった`,
          causes: [ev.id],
          data: dist,
        });
      }
      learnStance(w, from, to, cand, "gave in to your threat");
      return `${toName} gave in`;
    }
    if (response === "counter" && counters.length) {
      // 脅し返し: 相手が先に暴いたら、こちらも暴ける（抑止）
      w.threats.push({
        id: ev.id,
        day: w.day,
        from: to,
        to: from,
        fact: counters[0],
        candidate: cand,
        channel: "court",
        deadline: w.totalDays,
        status: "deterrent",
      });
      addKnowers(w, from, counters[0], [to]);
      return `${toName} threatened you back: they know "${w.facts[counters[0]].text}"`;
    }
    if (response === "seek_help" && lead) {
      // 頭目に助けを求める: 脅されたことと、その秘密が頭目に伝わる
      const lm = w.minds[lead];
      lm.reports.push({
        day: w.day,
        from: to,
        lines: [
          `${fromName} is threatening to ${channelText(w, channel)} that "${f.text}" unless I back ${name(w, cand)}. I refused and ask for your protection.`,
        ],
      });
      if (!lm.knowledge.some((k) => k.factId === factId))
        lm.knowledge.push({ factId, belief: 0.9, source: to, via: "self", day: w.day });
      addKnowers(w, lead, factId, [to, from, ...f.parties]);
      return `${toName} refused and went to ${name(w, lead)} for protection`;
    }
    return `${toName} refused and defied you`;
  };
}

/** 命令: 脅しに屈した相手に、王への報告を命じる。従うかは恐れと利害で決まる。拒めば、脅しは実行の段階に戻る */
async function askOrder(w: World, from: Id, to: Id, factId: Id): Promise<Apply> {
  const toName = name(w, to);
  const f = w.facts[factId];
  const hold = w.minds[to].coercedBy;
  const holdText = hold
    ? ` ${name(w, from)} still holds "${w.facts[hold.fact]?.text}" over you.${exposureText(hold.fact)}`
    : "";
  const state = `${describe(w, to)}\n\nJust now, ${name(w, from)} told you in private: "${f.text}"${concerns(w, to, factId)} and ordered you to report it to the King.${holdText}`;
  const [hear, a] = await Promise.all([
    askFact(w, from, to, factId),
    ask(state, { obey: { type: "boolean", instructions: `Does ${toName} obey this order?` } }),
  ]);
  const p = bool(a.obey);
  const obeyed = yes(p, `${to}:${w.day}:${w.turn}:order`);
  return (meet) => {
    const ev = addEvent(w, {
      day: w.day,
      actor: from,
      kind: "order",
      target: to,
      factId,
      text: `${name(w, from)} は脅しに屈した ${toName} に王への報告を命じ、${obeyed ? "従わせた" : "拒まれた"}（従う確率 ${p.toFixed(2)}）`,
      causes: [meet.id],
      data: { obey: p },
    });
    hear(ev);
    if (obeyed) {
      w.pending.push({
        actor: to,
        action: `tell:${KING}:${factId}`,
        requestEventId: ev.id,
        from,
        day: w.day,
        kind: "order",
      });
      return `${toName} agreed to obey`;
    }
    // 命令を拒んだら、元の脅しは「拒まれた」状態に戻り、脅した側は実行するか決める
    const t = w.threats.find((x) => x.from === from && x.to === to && x.status === "complied");
    if (t) {
      t.status = "refused";
      t.deadline = w.day + 1;
    }
    return `${toName} refused the order and defied you`;
  };
}

/**
 * 秘密が暴かれたときの結果（事実ごと、1 回だけ）。暴かれた = 公に告発された、または王が信じた。
 * 王に会えなくなる／会えるようになる／評価が動く。宮廷の全員が知る。
 */
function applyExposure(w: World, factId: Id, cause: Event) {
  if (w.exposed.includes(factId)) return;
  const e = exposureEffects[factId];
  if (!e) return;
  w.exposed.push(factId);
  for (const id of e.loseAccess ?? []) w.people[id].accessToKing = false;
  for (const id of e.gainAccess ?? []) w.people[id].accessToKing = true;
  for (const s of e.opinionShift ?? []) {
    const m = w.minds[s.who];
    m.opinions[s.candidate] = clamp((m.opinions[s.candidate] ?? 2) + s.delta);
  }
  // 王宮の全員の、その人への信頼が動く
  for (const s of e.trustShift ?? [])
    for (const [id, m] of Object.entries(w.minds))
      if (id !== s.about && m.trust[s.about] !== undefined)
        m.trust[s.about] = clamp(m.trust[s.about] + s.delta);
  for (const id of Object.keys(w.people)) if (id !== KING) remember(w, id, e.text);
  const ev = addEvent(w, {
    day: w.day,
    actor: KING,
    kind: "exposed",
    factId,
    text: `暴露の結果: ${e.text}`,
    causes: [cause.id],
  });
  // 暴かれた弱みでは、もう脅せない。それで屈していた人は解放される
  releaseCoerced(w, factId, ev, "は弱みが暴かれ、脅しから解放された");
  // この弱みを使う脅しは、もう意味を持たない（失効とは区別する。信用には数えない）
  for (const t of w.threats) if (t.fact === factId && t.status !== "carried") t.status = "moot";
}

/**
 * その弱みで屈していた人を解放する。支持は脅される前に戻す（脅しで変わった支持は本心ではない）。
 * 戻さないと、解放後も脅した側の陣営の構成員として、その陣営の計画に組み込まれてしまう。
 */
export function releaseCoerced(w: World, factId: Id, cause: Event, text: string) {
  for (const [id, m] of Object.entries(w.minds)) {
    if (m.allegiance !== "coerced" || m.coercedBy?.fact !== factId) continue;
    const before = m.support;
    const back = m.coercedBy.previousSupport;
    m.allegiance = back === "undecided" ? "independent" : "leaning";
    m.coercedBy = undefined;
    const ev = addEvent(w, {
      day: w.day,
      actor: id,
      kind: "released",
      text: `${name(w, id)} ${text}`,
      causes: [cause.id],
    });
    if (back !== before) {
      m.support = back;
      addEvent(w, {
        day: w.day,
        actor: id,
        kind: "switch",
        target: back === "undecided" ? undefined : back,
        text: `${name(w, id)} の支持が解放により ${name(w, before)} から ${name(w, back)} に戻った`,
        causes: [ev.id],
      });
    }
  }
}

/**
 * 行動が拒まれた脅しの実行にあたるなら、脅しを「実行した」にする。標的は脅した人の信用を覚える。
 * 脅し返しを受けていた場合、相手側に報復の機会（拒まれた脅しと同じ扱い）が生まれる。
 */
function markCarriedOut(w: World, actor: Id, action: string, cause: Event) {
  for (const t of w.threats.filter(
    (x) => x.from === actor && x.status === "refused" && carryOutKey(x) === action,
  )) {
    t.status = "carried";
    reputationOf(w, t.to, actor).kept++;
    addEvent(w, {
      day: w.day,
      actor,
      kind: "carried_out",
      target: t.to,
      factId: t.fact,
      text: `${name(w, actor)} は ${name(w, t.to)} への脅しを実行した`,
      causes: [cause.id, t.id],
    });
    for (const d of w.threats.filter((x) => x.status === "deterrent" && x.from === t.to && x.to === actor)) {
      d.status = "refused";
      d.deadline = w.day + 1;
    }
  }
}

/** observer が知っている、about の脅しの信用の記録（無ければ作る） */
function reputationOf(w: World, observer: Id, about: Id) {
  const reps = w.minds[observer].reputations;
  if (!reps[about]) reps[about] = { kept: 0, lapsed: 0 };
  return reps[about];
}

/** 期限を過ぎた脅しを失効させる。標的は「脅しは口先だけ」と覚える */
function lapseThreats(w: World) {
  for (const t of w.threats.filter((x) => x.status === "refused" && x.deadline <= w.day)) {
    t.status = "lapsed";
    reputationOf(w, t.to, t.from).lapsed++;
    addEvent(w, {
      day: w.day,
      actor: t.from,
      kind: "lapsed",
      target: t.to,
      factId: t.fact,
      text: `${name(w, t.from)} の ${name(w, t.to)} への脅しは実行されずに失効した`,
      causes: [t.id],
    });
  }
}

/** 口止め: 知っていると分かっている相手に、黙っていてもらう */
async function askSilence(w: World, from: Id, to: Id, factId: Id): Promise<Apply> {
  const toName = name(w, to);
  const f = w.facts[factId];
  const state = `${describe(w, to)}\n\nJust now, ${name(w, from)} asked you privately to keep this secret and tell no one: "${f.text}"`;
  const a = await ask(state, {
    agree: { type: "boolean", instructions: `Does ${toName} promise to keep it secret?` },
    trust_change: {
      type: "score",
      instructions: `After this, how does ${toName}'s trust in ${name(w, from)} change?`,
      criteria: TRUST_CHANGE,
    },
  });
  const p = bool(a.agree);
  const agreed = yes(p, `${to}:${w.day}:${w.turn}:silence`);
  return (meet) => {
    const ev = addEvent(w, {
      day: w.day,
      actor: from,
      kind: "silence",
      target: to,
      factId,
      text: `${name(w, from)} は ${toName} に「${f.text}」の口止めをし、${agreed ? "約束させた" : "断られた"}（約束する確率 ${p.toFixed(2)}）`,
      causes: [meet.id],
      data: { agree: p },
    });
    adjustTrust(w, to, from, score(a.trust_change).score);
    addKnowers(w, to, factId, [from]);
    w.minds[to].testimony.push({ day: w.day, from, kind: "silence", about: factId, agreed, eventId: ev.id });
    w.minds[from].commitments.push({ day: w.day, kind: "silence", to, fact: factId, agreed });
    return `${toName} ${agreed ? "promised to keep it secret" : "refused to promise"}`;
  };
}

/** 告発: 王以外の宮廷の全員が同時に聞く。王は報告で知る */
async function askAccusation(w: World, accuser: Id, factId: Id): Promise<Apply> {
  const audience = Object.keys(w.people).filter((id) => id !== accuser && id !== KING);
  const reactions = await Promise.all(audience.map((id) => askFact(w, accuser, id, factId, "public")));
  return (cause) => {
    const ev = addEvent(w, {
      day: w.day,
      actor: accuser,
      kind: "accuse",
      factId,
      text: `${name(w, accuser)} が宮廷で公に告発した:「${w.facts[factId].text}」`,
      causes: [cause.id, ...learnedFrom(w, accuser, factId)],
    });
    const seen = reactions.map((r) => r(ev));
    if (!w.publicFacts.includes(factId)) w.publicFacts.push(factId);
    // 宮廷の過半数が信じたときだけ、暴露として結果が起きる（疑われた告発では失脚しない）
    const believed = seen.filter((x) => x?.includes("believe")).length;
    if (believed * 2 >= seen.length) applyExposure(w, factId, ev);
    // 弱みが公になれば、それで脅されていた人は解放される
    releaseCoerced(w, factId, ev, "は弱みが公になり、脅しから解放された");
    return `${believed} of ${seen.length} at court seemed to believe it`;
  };
}

/** 目撃を伝える: 聞き手は「V が H を訪ねていた」を知る。信じるかと、話し手への信頼を問う */
async function askSighting(w: World, speaker: Id, listener: Id, visitor: Id, host: Id): Promise<Apply> {
  const listenerName = name(w, listener);
  const state = `${describe(w, listener)}\n\nJust now, ${name(w, speaker)} told you in private that ${name(w, visitor)} has been secretly visiting ${name(w, host)}.`;
  const a = await ask(state, {
    believe: { type: "boolean", instructions: `Does ${listenerName} believe this?` },
    trust_change: {
      type: "score",
      instructions: `After this, how does ${listenerName}'s trust in ${name(w, speaker)} change?`,
      criteria: TRUST_CHANGE,
    },
  });
  const belief = bool(a.believe);
  return (cause) => {
    adjustTrust(w, listener, speaker, score(a.trust_change).score);
    if (belief >= 0.5)
      w.minds[listener].sightings.push({ day: w.day, turn: w.turn, visitor, host, source: speaker });
    w.minds[listener].testimony.push({
      day: w.day,
      from: speaker,
      kind: "sighting",
      about: visitor,
      eventId: cause.id,
    });
    addEvent(w, {
      day: w.day,
      actor: listener,
      kind: "hear_sighting",
      target: speaker,
      text: `${listenerName} は ${name(w, speaker)} から「${name(w, visitor)} が ${name(w, host)} を訪ねていた」と聞き、${belief >= 0.5 ? "信じた" : "疑った"}`,
      causes: [cause.id],
      data: { belief },
    });
    return `${listenerName} ${belief >= 0.5 ? "seemed to believe it" : "seemed doubtful"}`;
  };
}

/**
 * 証拠を陣営の外へ託す。王に会える相手には「王に届けてほしい」と頼み、会えない相手には「預かってほしい」と頼む。
 * 相手が引き受けたときだけ渡す（断られたら渡さない）。王に届ける約束は「約束した」の印になる。
 * 相手は、見せられた証拠で事実を知る（断っても、見たことは消えない）。
 * （実測で、頼みのない受け渡しは、受け取った側に使う理由がなく、証拠を手放しただけになった）
 */
async function askGive(w: World, from: Id, to: Id, evidenceId: Id): Promise<Apply> {
  const e = w.evidence[evidenceId];
  const toName = name(w, to);
  const toKing = w.people[to].accessToKing;
  const ask2 = toKing ? `and asked you to present it to the King` : `and asked you to keep it safe`;
  const state = `${describe(w, to)}\n\nJust now, ${name(w, from)} privately offered you ${e.name}, which proves: "${w.facts[e.fact].text}"${concerns(w, to, e.fact)}, ${ask2}.`;
  const [hear, a] = await Promise.all([
    askFact(w, from, to, e.fact),
    ask(state, {
      agree: {
        type: "boolean",
        instructions: toKing
          ? `Does ${toName} agree to take it and present it to the King?`
          : `Does ${toName} agree to take it and keep it?`,
      },
    }),
  ]);
  const p = bool(a.agree);
  const agreed = yes(p, `${to}:${w.day}:${w.turn}:give`);
  return (cause) => {
    const seen = hear(cause);
    if (e.holder !== from) return "you no longer had it";
    if (!agreed) {
      addEvent(w, {
        day: w.day,
        actor: from,
        kind: "give_refused",
        target: to,
        text: `${name(w, from)} は ${e.name} を ${toName} に託そうとしたが断られた（引き受ける確率 ${p.toFixed(2)}）`,
        causes: [cause.id],
        data: { agree: p },
      });
      return `${toName} refused to take ${e.name}; you kept it`;
    }
    e.holder = to;
    w.minds[to].knownHolders[e.id] = to;
    w.minds[from].knownHolders[e.id] = to;
    const ev = addEvent(w, {
      day: w.day,
      actor: from,
      kind: "evidence_moved",
      target: to,
      text: `${name(w, from)} は ${e.name} を ${toName} に託した${toKing ? "（王に届ける約束）" : ""}（引き受ける確率 ${p.toFixed(2)}）`,
      causes: [cause.id],
      data: { agree: p },
    });
    if (toKing)
      w.pending.push({
        actor: to,
        action: `tell:${KING}:${e.fact}`,
        requestEventId: ev.id,
        from,
        day: w.day,
      });
    return `${toName} took ${e.name}${toKing ? " and promised to present it to the King" : ""}; ${seen ?? ""}`;
  };
}

/** 証拠を処分する: 以後、誰も示せない。処分したことは本人だけが知る（他人は持ち主がまだ持っていると思っている） */
function destroyEvidence(w: World, by: Id, evidenceId: Id): Apply {
  const e = w.evidence[evidenceId];
  return (cause) => {
    if (e.holder !== by) return "you no longer had it";
    e.holder = undefined;
    delete w.minds[by].knownHolders[e.id];
    addEvent(w, {
      day: w.day,
      actor: by,
      kind: "evidence_destroyed",
      text: `${name(w, by)} は ${e.name} を処分した`,
      causes: [cause.id],
    });
    return `you destroyed ${e.name}`;
  };
}

/** 1 件の行動を解決する。ask 段を実行し、apply 段を返す */
async function resolve(w: World, c: TurnChoice): Promise<() => void> {
  const a = parseAction(c.action);
  const actorName = name(w, c.actor);
  const mine = favored(w, c.actor);
  let reaction: Apply | undefined;
  switch (a.kind) {
    case "tell":
      if (a.target && a.fact) reaction = await askFact(w, c.actor, a.target, a.fact);
      break;
    case "urge":
      if (a.target && mine) reaction = await askUrge(w, c.actor, a.target, mine);
      break;
    case "probe":
      if (a.target) reaction = await askProbe(w, c.actor, a.target);
      break;
    case "request":
      if (a.target && a.fact) reaction = await askRequest(w, c.actor, a.target, a.fact);
      break;
    case "threaten":
      if (a.target && a.fact && mine)
        reaction = await askThreat(w, c.actor, a.target, a.fact, mine, a.channel ?? "court");
      break;
    case "order":
      if (a.target && a.fact) reaction = await askOrder(w, c.actor, a.target, a.fact);
      break;
    case "silence":
      if (a.target && a.fact) reaction = await askSilence(w, c.actor, a.target, a.fact);
      break;
    case "accuse":
      if (a.fact) reaction = await askAccusation(w, c.actor, a.fact);
      break;
    case "tellseen":
      if (a.target && a.visitor && a.host)
        reaction = await askSighting(w, c.actor, a.target, a.visitor, a.host);
      break;
    case "give":
      if (a.target && a.evidence) reaction = await askGive(w, c.actor, a.target, a.evidence);
      break;
    case "destroy":
      if (a.evidence) reaction = destroyEvidence(w, c.actor, a.evidence);
      break;
    case "extort":
      if (a.target && a.fact && a.evidence && mine)
        reaction = await askThreat(w, c.actor, a.target, a.fact, mine, "court", a.evidence);
      break;
    case "wait":
      break;
  }
  return () => {
    const causes = [c.interventionId, c.fromRequest].filter((x): x is number => x !== undefined);
    const where =
      a.kind === "wait"
        ? "様子を見た"
        : a.kind === "accuse"
          ? "宮廷で動いた"
          : `${name(w, a.target ?? "")} と密談`;
    const ev = addEvent(w, {
      day: w.day,
      actor: c.actor,
      kind: a.kind === "wait" ? "wait" : "act",
      target: a.target,
      factId: a.fact,
      text: `${actorName} ${where}（${c.action}）${c.fromRequest !== undefined ? " ※依頼の実行" : ""}`,
      causes,
      data: c.raw,
    });
    // 脅しの実行は反応より先に記録する（反応の中で暴露が起きると、脅しの状態が変わるため）
    markCarriedOut(w, c.actor, c.action, ev);
    const outcome = a.kind === "wait" ? "you watched and waited" : (reaction?.(ev) ?? "nothing came of it");
    w.minds[c.actor].actionLog.push({ day: w.day, turn: w.turn, action: c.action, outcome });
  };
}

// ---- 王

/** 王が各候補をどう見ているか */
async function kingAssess(w: World) {
  const suit: Record<Id, number> = {};
  const probs: Record<Id, Probabilities> = {};
  const questions: Questions = Object.fromEntries(
    candidates(w).map((c) => [
      c.id,
      {
        type: "score" as const,
        instructions: `How fit is ${c.name} to be named heir, in the King's private judgment right now?`,
        criteria: SUIT_LEVELS,
      },
    ]),
  );
  const a = await ask(describe(w, KING), questions);
  for (const c of candidates(w)) {
    suit[c.id] = score(a[c.id]).score;
    probs[c.id] = score(a[c.id]).probabilities;
  }
  w.kingSuitability.push(suit);
  w.minds[KING].opinions = { ...suit };
  addEvent(w, {
    day: w.day,
    actor: KING,
    kind: "assess",
    text: `王の評価: ${candidates(w)
      .map((c) => `${c.name} ${suit[c.id].toFixed(2)}`)
      .join(" / ")}`,
    causes: [],
    data: probs,
  });
}

export async function kingDecide(w: World) {
  const state = `${describe(w, KING)}\n\nToday is the day. The court is assembled. The King must name his heir now.`;
  const a = await ask(state, {
    heir: {
      type: "choice",
      instructions: `Whom does King Aldric name as heir?`,
      criteria: Object.fromEntries(candidates(w).map((c) => [c.id, `${c.name}, ${c.role}`])),
    },
  });
  const heir = argmax(choice(a.heir));
  addEvent(w, {
    day: w.day,
    actor: KING,
    kind: "name_heir",
    target: heir,
    text: `王は ${name(w, heir)} を後継者に指名した [${fmt(choice(a.heir))}]`,
    causes: [],
    data: choice(a.heir),
  });
  return { heir, probabilities: choice(a.heir) };
}
