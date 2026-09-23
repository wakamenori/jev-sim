import { KING } from "../cast.ts";
import { supportCriteria } from "../decision.ts";
import { concerns, describe } from "../describe.ts";
import { bool, choice, type Evaluate, type Questions, score } from "../evaluation.ts";
import { learnStance } from "../perception.ts";
import { argmax, makeRng, sampleFocused } from "../random.ts";
import {
  addEvent,
  addKnowers,
  adjustTrust,
  applyExposure,
  backedAtCourt,
  candidates,
  clamp,
  knows,
  learnedFrom,
  name,
  releaseCoerced,
  remember,
  setSupport,
  usableEvidence,
} from "../rules.ts";
import type { Id, Mind, World } from "../types.ts";
import { type Apply, CHANGE_LEVELS, EVIDENCE_FLOOR, TRUST_CHANGE, URGE_WEIGHT, yes } from "./shared.ts";
/**
 * 聞き手が事実を信じるか、話し手への信頼、各候補の評価がどう動くか。
 * 候補の評価は「真だとしたら」で問い、信じる確率で重み付けする（1 回の呼び出しに収めるため）。
 * 出所も伝わる: 話し手が誰から聞いたか。
 */
export async function askFact(
  ask: Evaluate,
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
export async function askUrge(ask: Evaluate, w: World, speaker: Id, listener: Id, cand: Id): Promise<Apply> {
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

export async function askProbe(ask: Evaluate, w: World, asker: Id, target: Id): Promise<Apply> {
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
  const hear = await askFact(ask, w, target, asker, told);
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

/** 依頼: 味方に事実を伝え、王への報告を頼む。引き受けた約束は選択肢に残り、実行するかは本人が選ぶ */
export async function askRequest(ask: Evaluate, w: World, from: Id, to: Id, factId: Id): Promise<Apply> {
  const toName = name(w, to);
  const f = w.facts[factId];
  // 頼まれた事実が自分や自陣営に関わるなら、問いの文面で明記する（自分の秘密を王に報告させられないように）
  const state = `${describe(w, to)}\n\nJust now, ${name(w, from)} told you in private: "${f.text}"${concerns(w, to, factId)} and asked you to report it to the King at your next audience.`;
  const [hear, a] = await Promise.all([
    askFact(ask, w, from, to, factId),
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
export async function askSilence(ask: Evaluate, w: World, from: Id, to: Id, factId: Id): Promise<Apply> {
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
export async function askAccusation(ask: Evaluate, w: World, accuser: Id, factId: Id): Promise<Apply> {
  const audience = Object.keys(w.people).filter((id) => id !== accuser && id !== KING);
  const reactions = await Promise.all(audience.map((id) => askFact(ask, w, accuser, id, factId, "public")));
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
    if (believed * 2 > seen.length) applyExposure(w, factId, ev);
    // 弱みが公になれば、それで脅されていた人は解放される
    releaseCoerced(w, factId, ev, "は弱みが公になり、脅しから解放された");
    return `${believed} of ${seen.length} at court seemed to believe it`;
  };
}

/** 目撃を伝える: 聞き手は「V が H を訪ねていた」を知る。信じるかと、話し手への信頼を問う */
export async function askSighting(
  ask: Evaluate,
  w: World,
  speaker: Id,
  listener: Id,
  visitor: Id,
  host: Id,
): Promise<Apply> {
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
