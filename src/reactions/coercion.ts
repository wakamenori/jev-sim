import { KING } from "../cast.ts";
import { channelText, concerns, describe, exposureText } from "../describe.ts";
import { bool, choice, type Evaluate, score } from "../evaluation.ts";
import { learnStance, perceivedSupport } from "../perception.ts";
import { fmt, makeRng, sample } from "../random.ts";
import { addEvent, addKnowers, adjustTrust, leaderOf, name, usableEvidence } from "../rules.ts";
import type { Id, Threat, ThreatChannel, World } from "../types.ts";
import { askFact } from "./information.ts";
import { type Apply, TRUST_CHANGE, yes } from "./shared.ts";

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
export async function askThreat(
  ask: Evaluate,
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
  const lead = leaderOf(w, to);
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
    if (response === "comply" && demanded && demanded.holder !== to)
      return `${toName} no longer held ${demanded.name}`;
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
export async function askOrder(ask: Evaluate, w: World, from: Id, to: Id, factId: Id): Promise<Apply> {
  const toName = name(w, to);
  const f = w.facts[factId];
  const hold = w.minds[to].coercedBy;
  const holdText = hold
    ? ` ${name(w, from)} still holds "${w.facts[hold.fact]?.text}" over you.${exposureText(hold.fact)}`
    : "";
  const state = `${describe(w, to)}\n\nJust now, ${name(w, from)} told you in private: "${f.text}"${concerns(w, to, factId)} and ordered you to report it to the King.${holdText}`;
  const [hear, a] = await Promise.all([
    askFact(ask, w, from, to, factId),
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
