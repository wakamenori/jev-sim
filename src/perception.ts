// 見られることと、他人についての推測。
// 人は自分が見聞きしたことしか知らない。他人の支持は、公の立場と観察と働きかけから推測する。
import { KING, publicStance, watchers } from "./cast.ts";
import { makeRng } from "./random.ts";
import type { BeliefAboutPerson, Id, World } from "./types.ts";

const name = (w: World, id: Id) => w.people[id]?.name ?? id;

/** 初期の推測: 公の立場の人の支持は全員が知っている。候補本人は自分自身を推す */
export function initBeliefs(w: World) {
  for (const observer of Object.keys(w.people)) {
    const beliefs: Record<Id, BeliefAboutPerson> = {};
    for (const id of Object.keys(w.people)) {
      if (id === observer || id === KING) continue;
      const theirs = w.minds[id].support;
      if (w.people[id].candidate) beliefs[id] = { support: id, note: "a candidate", day: 0 };
      else if (publicStance.includes(id)) beliefs[id] = { support: theirs, note: "publicly known", day: 0 };
      // 同じ陣営の仲間同士は、互いの支持を知っている
      else if (theirs !== "undecided" && theirs === w.minds[observer].support)
        beliefs[id] = { support: theirs, note: "an ally in your faction", day: 0 };
    }
    w.minds[observer].beliefs = beliefs;
  }
}

/** observer が思う id の支持。自分自身なら本心、候補本人なら本人 */
export function perceivedSupport(w: World, observer: Id, id: Id): Id | "undecided" | "unknown" {
  if (id === observer) return w.minds[id].support;
  if (w.people[id].candidate) return id;
  return w.minds[observer].beliefs[id]?.support ?? "unknown";
}

/** 選択肢や state に書く、observer から見た id の立場 */
export function perceivedLabel(w: World, observer: Id, id: Id): string {
  if (id === KING) return "the judge";
  if (w.people[id].candidate) return "a candidate";
  const s = perceivedSupport(w, observer, id);
  if (s === "unknown") return "allegiance unknown to you";
  if (s === "undecided") return "backs no one, as far as you know";
  return `you believe they back ${name(w, s)}`;
}

/** 確実に分かった立場を記録する（説得されたとき、話し手の支持先が分かる、など） */
export function learnStance(w: World, observer: Id, about: Id, support: Id | "undecided", note: string) {
  if (observer === about || w.people[about].candidate) return;
  w.minds[observer].beliefs[about] = { support, note, day: w.day };
}

// ---- 目撃

export interface Meeting {
  visitor: Id;
  host: Id;
}

/** そのターンの密談を、見張る人が記録する。当事者は数えない */
export function recordSightings(w: World, meetings: Meeting[]) {
  for (const [watcher, rule] of Object.entries(watchers)) {
    let seen: Meeting[] = [];
    if (rule.startsWith("host:")) {
      const host = rule.slice(5);
      seen = meetings.filter((m) => m.host === host);
    } else if (rule === "access") {
      seen = meetings.filter((m) => !w.people[m.visitor].accessToKing && w.people[m.host].accessToKing);
    } else if (rule.startsWith("random:")) {
      const n = Number(rule.slice(7));
      const rnd = makeRng(`${watcher}:${w.day}:${w.turn}:watch`);
      seen = [...meetings].sort((a, b) => `${a.visitor}${a.host}`.localeCompare(`${b.visitor}${b.host}`));
      for (let i = seen.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [seen[i], seen[j]] = [seen[j], seen[i]];
      }
      seen = seen.slice(0, n);
    }
    for (const m of seen) {
      if (m.visitor === watcher || m.host === watcher) continue;
      w.minds[watcher].sightings.push({ day: w.day, turn: w.turn, ...m, source: "self" });
    }
  }
}

/** 最近の目撃（自分が当事者でない、訪問者と相手の組ごとに最新のもの）。新しい順 */
export function recentSightings(w: World, pid: Id, days = 3, limit = 6) {
  const latest = new Map<string, World["minds"][string]["sightings"][number] & { count: number }>();
  for (const s of w.minds[pid].sightings) {
    if (s.day < w.day - days) continue;
    const k = `${s.visitor}>${s.host}`;
    const prev = latest.get(k);
    latest.set(k, { ...s, count: (prev?.count ?? 0) + 1 });
  }
  return [...latest.values()].sort((a, b) => b.day - a.day || b.turn - a.turn).slice(0, limit);
}

export function sightingLine(
  w: World,
  s: { day: number; visitor: Id; host: Id; source: Id | "self"; count?: number },
) {
  const times = s.count && s.count > 1 ? ` (${s.count} times recently)` : "";
  const src = s.source === "self" ? "you saw it" : `${name(w, s.source)} told you`;
  return `- ${name(w, s.visitor)} privately visited ${name(w, s.host)}, last on day ${s.day}${times} (${src})`;
}
