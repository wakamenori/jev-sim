import {
  evidenceDefs,
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
import { initBeliefs } from "./perception.ts";
import { uniq } from "./rules.ts";
import type { Allegiance, Id, Mind, World } from "./types.ts";
export function buildWorld(): World {
  const w: World = {
    day: 0,
    turn: 0,
    totalDays: TOTAL_DAYS,
    // 王に会えるかは実行中に変わる（失脚など）ので、人物設定は世界ごとに複製する
    people: Object.fromEntries(people.map((p) => [p.id, { ...p }])),
    minds: {},
    facts: Object.fromEntries(facts.map((f) => [f.id, structuredClone(f)])),
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

export function takeSnapshot(w: World) {
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

export function startDay(w: World) {
  w.day++;
  w.turn = 0;
}

export function closeDay(w: World) {
  takeSnapshot(w);
}
