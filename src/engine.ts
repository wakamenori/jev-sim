import { parseAction } from "./actions.ts";
import { KING } from "./cast.ts";
import { type ChooseAction, chooseAction, type TurnChoice } from "./decision.ts";
import { describe } from "./describe.ts";
import { choice, type Evaluate, type Probabilities, type Questions, score } from "./evaluation.ts";
import { type Meeting, recordSightings } from "./perception.ts";
import { argmax, fmt } from "./random.ts";
import { askOrder, askThreat } from "./reactions/coercion.ts";
import { askGive, destroyEvidence } from "./reactions/evidence.ts";
import {
  askAccusation,
  askFact,
  askProbe,
  askRequest,
  askSighting,
  askSilence,
  askUrge,
} from "./reactions/information.ts";
import type { Apply } from "./reactions/shared.ts";
import { addEvent, candidates, favored, lapseThreats, markCarriedOut, name, setSupport } from "./rules.ts";
import type { Id, World } from "./types.ts";

const SUIT_LEVELS = ["unfit", "doubtful", "acceptable", "good", "the best choice"];

export function createEngine(
  ask: Evaluate,
  selectAction: ChooseAction = (w, pid, support) => chooseAction(ask, w, pid, support),
) {
  async function runTurn(w: World) {
    const actors = Object.keys(w.people).filter((id) => id !== KING);
    const choices = await Promise.all(actors.map((pid) => selectAction(w, pid, true)));
    const supportBefore = new Map(actors.map((pid) => [pid, w.minds[pid].support]));
    // 支持の更新は、決まった順で記録する
    for (const c of choices) {
      if (c.support !== undefined) setSupport(w, c.actor, c.support, c.raw.support ?? {}, []);
    }
    // ターンの始めに支持が変わった人は、新しい立場で行動を選び直す。
    // 古い立場で選んだ手（前の陣営の計画など）を、新しい立場のまま実行しないように
    const switched = choices.filter((c) => w.minds[c.actor].support !== supportBefore.get(c.actor));
    const redone = await Promise.all(switched.map((c) => selectAction(w, c.actor, false)));
    for (const r of redone) {
      const i = choices.findIndex((c) => c.actor === r.actor);
      choices[i] = { ...r, support: choices[i].support, raw: { ...choices[i].raw, ...r.raw } };
    }
    // 依頼の消化は、選び直したあとの行動で判定する
    for (const c of choices)
      c.fromRequest = w.pending.find((x) => x.actor === c.actor && x.action === c.action)?.requestEventId;
    for (const c of choices)
      if (c.fromRequest !== undefined)
        w.pending = w.pending.filter((x) => x.requestEventId !== c.fromRequest);
    const applies = await Promise.all(choices.map((c) => resolve(w, c)));
    for (const apply of applies) apply();
    // 見張る人が、このターンの訪問を記録する（中身は見えない）
    const meetings: Meeting[] = choices.flatMap((c) => {
      const a = parseAction(c.action);
      return a.target && a.kind !== "accuse" && a.kind !== "wait"
        ? [{ visitor: c.actor, host: a.target }]
        : [];
    });
    recordSightings(w, meetings);
  }

  async function endDay(w: World) {
    w.turn = 0;
    await kingAssess(w);
    // 引き受けた依頼は、翌日の終わりまでに果たさなければ失効する
    w.pending = w.pending.filter((x) => x.day >= w.day);
    lapseThreats(w);
  }

  async function resolve(w: World, c: TurnChoice): Promise<() => void> {
    const a = parseAction(c.action);
    const actorName = name(w, c.actor);
    const mine = favored(w, c.actor);
    let reaction: Apply | undefined;
    switch (a.kind) {
      case "tell":
        if (a.target && a.fact) reaction = await askFact(ask, w, c.actor, a.target, a.fact);
        break;
      case "urge":
        if (a.target && mine) reaction = await askUrge(ask, w, c.actor, a.target, mine);
        break;
      case "probe":
        if (a.target) reaction = await askProbe(ask, w, c.actor, a.target);
        break;
      case "request":
        if (a.target && a.fact) reaction = await askRequest(ask, w, c.actor, a.target, a.fact);
        break;
      case "threaten":
        if (a.target && a.fact && mine)
          reaction = await askThreat(ask, w, c.actor, a.target, a.fact, mine, a.channel ?? "court");
        break;
      case "order":
        if (a.target && a.fact) reaction = await askOrder(ask, w, c.actor, a.target, a.fact);
        break;
      case "silence":
        if (a.target && a.fact) reaction = await askSilence(ask, w, c.actor, a.target, a.fact);
        break;
      case "accuse":
        if (a.fact) reaction = await askAccusation(ask, w, c.actor, a.fact);
        break;
      case "tellseen":
        if (a.target && a.visitor && a.host)
          reaction = await askSighting(ask, w, c.actor, a.target, a.visitor, a.host);
        break;
      case "give":
        if (a.target && a.evidence) reaction = await askGive(ask, w, c.actor, a.target, a.evidence);
        break;
      case "destroy":
        if (a.evidence) reaction = destroyEvidence(w, c.actor, a.evidence);
        break;
      case "extort":
        if (a.target && a.fact && a.evidence && mine)
          reaction = await askThreat(ask, w, c.actor, a.target, a.fact, mine, "court", a.evidence);
        break;
      case "wait":
        break;
    }
    return () => {
      const causes = [c.fromRequest].filter((x): x is number => x !== undefined);
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

  async function kingDecide(w: World) {
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

  return { runTurn, endDay, kingDecide };
}
