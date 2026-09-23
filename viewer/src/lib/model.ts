import type { Event, Id, Snapshot, World } from "../../../src/types.ts";

export type { Event, Id, Snapshot, World };

/** 候補ごとの色。候補の並び順で割り当てる。undecided は灰 */
const PALETTE = ["#c2553a", "#3a7bc2", "#8a4fbf", "#3a9c6b", "#c29a3a"];
export const UNDECIDED_COLOR = "#8b8578";

export interface Index {
  world: World;
  candidates: Id[];
  color: (id: Id | string) => string;
  name: (id: Id | string | undefined) => string;
  eventById: Map<number, Event>;
  /** causes の逆引き。ある event を原因とする event */
  effects: Map<number, number[]>;
  days: number[];
  /** その日の終わりのスナップショット。無ければ最終状態で代用 */
  snapshotAt: (day: number) => Snapshot;
  kinds: string[];
  /** 判定者（王）。支持を持たないので支持表から外す。assess / name_heir の主体から推定する */
  judges: Set<Id>;
}

export function buildIndex(world: World): Index {
  const candidates = Object.values(world.people)
    .filter((p) => p.candidate)
    .map((p) => p.id);
  const colorMap = new Map(candidates.map((c, i) => [c, PALETTE[i % PALETTE.length]]));
  const eventById = new Map(world.events.map((e) => [e.id, e]));
  const effects = new Map<number, number[]>();
  for (const e of world.events) {
    for (const c of e.causes) {
      const list = effects.get(c) ?? [];
      list.push(e.id);
      effects.set(c, list);
    }
  }
  const lastDay = Math.max(world.day, ...world.events.map((e) => e.day));
  const days = Array.from({ length: lastDay }, (_, i) => i + 1);
  const snapshots = new Map((world.snapshots ?? []).map((s) => [s.day, s]));
  const finalSnapshot: Snapshot = { day: world.day, minds: world.minds };
  const snapshotAt = (day: number) => {
    for (let d = day; d >= 0; d--) {
      const s = snapshots.get(d);
      if (s) return s;
    }
    return finalSnapshot;
  };
  const kinds = [...new Set(world.events.map((e) => e.kind))].sort();
  const judges = new Set(
    world.events.filter((e) => e.kind === "name_heir" || e.kind === "assess").map((e) => e.actor),
  );
  return {
    world,
    candidates,
    color: (id) => colorMap.get(id) ?? UNDECIDED_COLOR,
    name: (id) => (id === undefined ? "-" : (world.people[id]?.name ?? world.facts[id]?.text ?? id)),
    eventById,
    effects,
    days,
    snapshotAt,
    kinds,
    judges,
  };
}

/** 原因側を再帰的にたどる。深さ付きで返す */
export function ancestry(ix: Index, id: number, depth = 0, seen = new Set<number>()): [Event, number][] {
  const e = ix.eventById.get(id);
  if (!e || seen.has(id)) return [];
  seen.add(id);
  return [[e, depth], ...e.causes.flatMap((c) => ancestry(ix, c, depth + 1, seen))];
}

/** 結果側を再帰的にたどる */
export function descendants(ix: Index, id: number, depth = 0, seen = new Set<number>()): [Event, number][] {
  if (seen.has(id)) return [];
  seen.add(id);
  const out: [Event, number][] = [];
  for (const child of ix.effects.get(id) ?? []) {
    const e = ix.eventById.get(child);
    if (!e) continue;
    out.push([e, depth]);
    out.push(...descendants(ix, child, depth + 1, seen));
  }
  return out;
}

export function heirOf(world: World): { heir: Id; probabilities?: Record<string, number> } | undefined {
  const e = [...world.events].reverse().find((x) => x.kind === "name_heir");
  if (!e?.target) return undefined;
  return { heir: e.target, probabilities: isDistribution(e.data) ? e.data : undefined };
}

/** 値が全部数値で 0..1 のオブジェクトなら確率分布とみなす */
export function isDistribution(v: unknown): v is Record<string, number> {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const vals = Object.values(v);
  return vals.length > 0 && vals.every((x) => typeof x === "number" && x >= 0 && x <= 1.0001);
}
