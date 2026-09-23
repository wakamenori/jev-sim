import { enumerateActions } from "./actions.ts";
import { describe, describeAction } from "./describe.ts";
import { choice, type Evaluate, type Probabilities, type Questions } from "./evaluation.ts";
import { argmax, makeRng, sampleFocused } from "./random.ts";
import {
  candidates,
  carryOutKey,
  name,
  pendingOf,
  remainingIntended,
  remainingPlanned,
  uniq,
} from "./rules.ts";
import type { Id, Mind, World } from "./types.ts";
export interface TurnChoice {
  actor: Id;
  action: string;
  support?: Mind["support"];
  raw: Record<string, Probabilities>;
  /** 引き受けた依頼の実行なら、その依頼の出来事 */
  fromRequest?: number;
}

export function supportCriteria(w: World): Record<string, string> {
  const c: Record<string, string> = Object.fromEntries(candidates(w).map((x) => [x.id, x.name]));
  c.undecided = "Commit to nobody yet";
  return c;
}

export async function chooseAction(ask: Evaluate, w: World, pid: Id, askSupport = true): Promise<TurnChoice> {
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
  if (questions.support) {
    c.raw.support = choice(a.support);
    c.support = argmax(c.raw.support) as Mind["support"];
  }
  return c;
}

export type ChooseAction = (w: World, pid: Id, askSupport: boolean) => Promise<TurnChoice>;
