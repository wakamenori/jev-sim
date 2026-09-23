import { exposureEffects, KING } from "./cast.ts";
import type { Probabilities } from "./evaluation.ts";
import { perceivedLabel, perceivedSupport } from "./perception.ts";
import { fmt } from "./random.ts";
import type { Event, Evidence, Id, Mind, Threat, World } from "./types.ts";
export const clamp = (v: number) => Math.min(4, Math.max(0, v));
export const uniq = <T>(xs: T[]) => [...new Set(xs)];
export const candidates = (w: World) => Object.values(w.people).filter((p) => p.candidate);
export const name = (w: World, id: Id) => w.people[id]?.name ?? id;

export function addEvent(w: World, e: Omit<Event, "id" | "turn">): Event {
  const ev: Event = { id: w.events.length + 1, turn: w.turn, ...e };
  w.events.push(ev);
  return ev;
}

export function remember(w: World, pid: Id, text: string) {
  const r = w.minds[pid].recent;
  r.push(`Day ${w.day}: ${text}`);
  if (r.length > 8) r.shift();
}

export function knows(m: Mind, factId: Id) {
  return m.knowledge.find((k) => k.factId === factId);
}

/** 話し手がその事実を知った出来事。元から知っていたなら無し */
export function learnedFrom(w: World, speaker: Id, factId: Id): number[] {
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

export const favored = (w: World, pid: Id): Id | undefined => {
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
function _concerns(w: World, pid: Id, factId: Id | undefined): string {
  if (!factId) return "";
  if (w.facts[factId]?.harms.includes(pid)) return " (exposing this would hurt you yourself)";
  if (w.facts[factId]?.parties.includes(pid)) return " (this concerns you yourself)";
  if (isOurSecret(w, pid, factId)) return " (this concerns your own side)";
  return "";
}

/** pid の陣営の、その日の計画（恐れて従っている人には無い） */
export function myPlan(w: World, pid: Id) {
  if (w.minds[pid].allegiance === "coerced") return undefined;
  return w.plans.find((p) => p.day === w.day && p.faction === favored(w, pid));
}

// ---- state の組み立て

export function doneToday(w: World, pid: Id): Set<string> {
  return new Set(w.minds[pid].actionLog.filter((a) => a.day === w.day).map((a) => a.action));
}

/**
 * 今日の計画のうち、pid に割り当てられて、まだ実行していない一手。
 * 計画の一手は 1 回実行すれば済む。実行後も印が残ると、失敗した手を同じ日に繰り返す。
 */
export function remainingPlanned(w: World, pid: Id) {
  const done = doneToday(w, pid);
  return myPlan(w, pid)?.moves.filter((m) => m.actor === pid && !done.has(m.action)) ?? [];
}

/** 個人の整理で決めた、今日の自分の手のうち未実行のもの */
export function remainingIntended(w: World, pid: Id) {
  const it = w.minds[pid].intention;
  if (!it || it.day !== w.day) return [];
  const done = doneToday(w, pid);
  return it.moves.filter((m) => !done.has(m.action));
}

/** 引き受けた依頼のうち、まだ実行していないもの */
export function pendingOf(w: World, pid: Id) {
  return w.pending.filter((x) => x.actor === pid);
}

/** 今王に会える人（失脚や取り立てで変わる） */
export function carryOutKey(t: Threat): string {
  if (t.channel === "court") return `accuse:${t.fact}`;
  if (t.channel === "king") return `tell:${KING}:${t.fact}`;
  return `tell:${t.channel}:${t.fact}`;
}

export function sameFaction(w: World, a: Id, b: Id): boolean {
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
export function canUse(w: World, pid: Id, e: Evidence): boolean {
  if (e.holder === undefined) return false;
  if (!knows(w.minds[pid], e.fact)) return false;
  if (e.holder === pid) return true;
  return sameFaction(w, pid, e.holder) && w.minds[pid].knownHolders[e.id] === e.holder;
}

export function usableEvidence(w: World, pid: Id, factId: Id): Evidence | undefined {
  return Object.values(w.evidence).find((e) => e.fact === factId && canUse(w, pid, e));
}

/**
 * 支持を書き換える。1 人の支持が変わるのは 1 ターンに 1 回まで。
 * 同じターンの反応はどれも同じ世界から問うので、複数の説得や脅しが重なると、書き戻すたびに支持が行き来してしまう。
 * 決まった順で先に書き戻された変化を優先する。
 */
export function setSupport(w: World, pid: Id, after: Mind["support"], dist: Probabilities, causes: number[]) {
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
/** leader: pid の陣営の頭目（助けを求める相手）。頭目本人、属さない人、恐れて従っている人には無い */
export function leaderOf(w: World, pid: Id): Id | undefined {
  const c = w.minds[pid].support;
  if (c === "undecided" || !factionOf(w, c).includes(pid)) return undefined;
  const lead = Object.values(w.people).find((p) => p.advisorOf === c)?.id;
  return lead && lead !== pid ? lead : undefined;
}

/**
 * 脅し返しに使える事実: to が知っていて、from か from の陣営（to の推測）が当事者で、まだ公でないもの。
 * 脅された事実そのものは除く（同じ秘密で脅し返しても意味がない）
/**
 * 秘密が暴かれたときの結果（事実ごと、1 回だけ）。暴かれた = 公に告発された、または王が信じた。
 * 王に会えなくなる／会えるようになる／評価が動く。宮廷の全員が知る。
 */
export function applyExposure(w: World, factId: Id, cause: Event) {
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
export function markCarriedOut(w: World, actor: Id, action: string, cause: Event) {
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
export function reputationOf(w: World, observer: Id, about: Id) {
  const reps = w.minds[observer].reputations;
  if (!reps[about]) reps[about] = { kept: 0, lapsed: 0 };
  return reps[about];
}

/** 期限を過ぎた脅しを失効させる。標的は「脅しは口先だけ」と覚える */
export function lapseThreats(w: World) {
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

export function adjustTrust(w: World, listener: Id, speaker: Id, levelScore: number): number {
  const lm = w.minds[listener];
  const delta = (levelScore - 2) * 0.5;
  lm.trust[speaker] = clamp(lm.trust[speaker] + delta);
  return delta;
}
