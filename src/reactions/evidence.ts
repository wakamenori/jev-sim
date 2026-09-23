import { KING } from "../cast.ts";
import { concerns, describe } from "../describe.ts";
import { bool, type Evaluate } from "../evaluation.ts";
import { addEvent, name } from "../rules.ts";
import type { Id, World } from "../types.ts";
import { askFact } from "./information.ts";
import { type Apply, yes } from "./shared.ts";

/**
 * 証拠を陣営の外へ託す。王に会える相手には「王に届けてほしい」と頼み、会えない相手には「預かってほしい」と頼む。
 * 相手が引き受けたときだけ渡す（断られたら渡さない）。王に届ける約束は「約束した」の印になる。
 * 相手は、見せられた証拠で事実を知る（断っても、見たことは消えない）。
 * （実測で、頼みのない受け渡しは、受け取った側に使う理由がなく、証拠を手放しただけになった）
 */
export async function askGive(ask: Evaluate, w: World, from: Id, to: Id, evidenceId: Id): Promise<Apply> {
  const e = w.evidence[evidenceId];
  const toName = name(w, to);
  const toKing = w.people[to].accessToKing;
  const ask2 = toKing ? `and asked you to present it to the King` : `and asked you to keep it safe`;
  const state = `${describe(w, to)}\n\nJust now, ${name(w, from)} privately offered you ${e.name}, which proves: "${w.facts[e.fact].text}"${concerns(w, to, e.fact)}, ${ask2}.`;
  const [hear, a] = await Promise.all([
    askFact(ask, w, from, to, e.fact),
    ask(state, {
      agree: {
        type: "boolean",
        instructions: toKing
          ? `Does ${toName} agree to take it and present it to the King?`
          : `Does ${toName} agree to take it and keep it?`,
      },
    }),
  ]);
  const p = bool(a.agree);
  const agreed = yes(p, `${to}:${w.day}:${w.turn}:give`);
  return (cause) => {
    const seen = hear(cause);
    if (e.holder !== from) return "you no longer had it";
    if (!agreed) {
      addEvent(w, {
        day: w.day,
        actor: from,
        kind: "give_refused",
        target: to,
        text: `${name(w, from)} は ${e.name} を ${toName} に託そうとしたが断られた（引き受ける確率 ${p.toFixed(2)}）`,
        causes: [cause.id],
        data: { agree: p },
      });
      return `${toName} refused to take ${e.name}; you kept it`;
    }
    e.holder = to;
    w.minds[to].knownHolders[e.id] = to;
    w.minds[from].knownHolders[e.id] = to;
    const ev = addEvent(w, {
      day: w.day,
      actor: from,
      kind: "evidence_moved",
      target: to,
      text: `${name(w, from)} は ${e.name} を ${toName} に託した${toKing ? "（王に届ける約束）" : ""}（引き受ける確率 ${p.toFixed(2)}）`,
      causes: [cause.id],
      data: { agree: p },
    });
    if (toKing)
      w.pending.push({
        actor: to,
        action: `tell:${KING}:${e.fact}`,
        requestEventId: ev.id,
        from,
        day: w.day,
      });
    return `${toName} took ${e.name}${toKing ? " and promised to present it to the King" : ""}; ${seen ?? ""}`;
  };
}

/** 証拠を処分する: 以後、誰も示せない。処分したことは本人だけが知る（他人は持ち主がまだ持っていると思っている） */
export function destroyEvidence(w: World, by: Id, evidenceId: Id): Apply {
  const e = w.evidence[evidenceId];
  return (cause) => {
    if (e.holder !== by) return "you no longer had it";
    e.holder = undefined;
    delete w.minds[by].knownHolders[e.id];
    addEvent(w, {
      day: w.day,
      actor: by,
      kind: "evidence_destroyed",
      text: `${name(w, by)} は ${e.name} を処分した`,
      causes: [cause.id],
    });
    return `you destroyed ${e.name}`;
  };
}

/** 1 件の行動を解決する。ask 段を実行し、apply 段を返す */
