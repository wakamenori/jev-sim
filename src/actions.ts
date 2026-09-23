import { KING } from "./cast.ts";
import { perceivedSupport, recentSightings } from "./perception.ts";
import { carryOutKey, favored, isOurSecret, knownToKnow, sameFaction, sameSide, uniq } from "./rules.ts";
import type { Id, ThreatChannel, World } from "./types.ts";
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

export const ACTION_FIELDS = {
  tell: ["target", "fact"],
  urge: ["target"],
  probe: ["target"],
  request: ["target", "fact"],
  threaten: ["target", "fact", "channel"],
  order: ["target", "fact"],
  silence: ["target", "fact"],
  accuse: ["fact"],
  tellseen: ["target", "visitor", "host"],
  give: ["target", "evidence"],
  destroy: ["evidence"],
  extort: ["target", "fact", "evidence"],
  wait: [],
} as const;
export type ActionKind = keyof typeof ACTION_FIELDS;
export const KINDS = Object.keys(ACTION_FIELDS).filter(
  (kind): kind is Exclude<ActionKind, "wait"> => kind !== "wait",
) as [Exclude<ActionKind, "wait">, ...Exclude<ActionKind, "wait">[]];

export function parseAction(key: string): Action {
  const [kind, ...values] = key.split(":");
  if (!Object.hasOwn(ACTION_FIELDS, kind)) throw new Error(`Unknown action: ${key}`);
  const fields = ACTION_FIELDS[kind as ActionKind];
  if (values.length !== fields.length || values.some((value) => !value))
    throw new Error(`Malformed action: ${key}`);
  return { kind: kind as ActionKind, ...Object.fromEntries(fields.map((field, i) => [field, values[i]])) };
}

export function toKey(action: Action): string {
  const fields = ACTION_FIELDS[action.kind];
  if (!fields) throw new Error(`Unknown action: ${action.kind}`);
  const values = fields.map((field) => action[field]);
  if (values.some((value) => !value || value.includes(":")))
    throw new Error(`Incomplete action: ${action.kind}`);
  return [action.kind, ...values].join(":");
}
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
