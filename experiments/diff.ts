import type { Event, Id, Snapshot, World } from "../src/types.ts";

/** 出来事の中身の比較用の鍵。id は実行ごとにずれるので使わない */
const eventKey = (e: Event) =>
  JSON.stringify([e.day, e.turn ?? 0, e.kind, e.actor, e.target ?? null, e.factId ?? null, e.text]);

function mindKey(s: Snapshot, id: Id): string {
  const m = s.minds[id];
  if (!m) return "";
  const r = (v: number) => Math.round(v * 100) / 100;
  return JSON.stringify([
    m.support,
    m.allegiance,
    Object.entries(m.beliefs ?? {}).sort(([a], [b]) => a.localeCompare(b)),
    Object.entries(m.trust)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, r(v)]),
    m.knowledge.map((k) => [k.factId, k.source, k.via, r(k.belief)]),
    Object.entries(m.opinions ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => [k, r(v)]),
    Object.entries(m.knownKnowers ?? {})
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, knowers]) => [id, [...knowers].sort()]),
  ]);
}

export interface RunDiff {
  heir: { base?: Id; fork?: Id; baseP?: Record<string, number>; forkP?: Record<string, number> };
  /** 最初に食い違った出来事（fork 側）。介入そのものは除く */
  firstDivergence?: { day: number; base?: string; fork?: string };
  /** 日ごとに、内面が元の実行と食い違っている人。バタフライエフェクトの広がり */
  divergedPeople: { day: number; people: Id[] }[];
  /** 日ごとの支持の食い違い */
  supportChanges: { day: number; id: Id; base: string; fork: string }[];
  kingSuitability: { day: number; base: Record<Id, number>; fork: Record<Id, number> }[];
}

export function diffRuns(base: World, fork: World): RunDiff {
  const heirOf = (w: World) => [...w.events].reverse().find((e) => e.kind === "name_heir");
  const hb = heirOf(base);
  const hf = heirOf(fork);

  const baseEvents = base.events.filter((e) => e.kind !== "intervene");
  const be = baseEvents.map(eventKey);
  const fe = fork.events.filter((e) => e.kind !== "intervene");
  let firstDivergence: RunDiff["firstDivergence"];
  for (let i = 0; i < Math.max(be.length, fe.length); i++) {
    const fk = fe[i] ? eventKey(fe[i]) : undefined;
    if (be[i] !== fk) {
      firstDivergence = { day: (fe[i] ?? baseEvents[i]).day, base: baseEvents[i]?.text, fork: fe[i]?.text };
      break;
    }
  }

  const divergedPeople: RunDiff["divergedPeople"] = [];
  const supportChanges: RunDiff["supportChanges"] = [];
  for (const fs of fork.snapshots) {
    const bs = base.snapshots.find((s) => s.day === fs.day);
    if (!bs) continue;
    const ids = Object.keys(fs.minds);
    divergedPeople.push({ day: fs.day, people: ids.filter((id) => mindKey(bs, id) !== mindKey(fs, id)) });
    for (const id of ids) {
      const a = bs.minds[id]?.support;
      const b = fs.minds[id]?.support;
      if (a !== b) supportChanges.push({ day: fs.day, id, base: a ?? "-", fork: b ?? "-" });
    }
  }
  const kingSuitability = fork.kingSuitability.map((f, i) => ({
    day: i + 1,
    base: base.kingSuitability[i] ?? {},
    fork: f,
  }));
  return {
    heir: {
      base: hb?.target,
      fork: hf?.target,
      baseP: hb?.data as Record<string, number>,
      forkP: hf?.data as Record<string, number>,
    },
    firstDivergence,
    divergedPeople,
    supportChanges,
    kingSuitability,
  };
}
