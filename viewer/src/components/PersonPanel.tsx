import type { Testimony } from "../../../src/types.ts";
import type { Id, Index } from "../lib/model.ts";

function testimonyText(ix: Index, t: Testimony): string {
  const fact = `「${ix.world.facts[t.about]?.text ?? t.about}」`;
  const ans = t.agreed === undefined ? "" : t.agreed ? "（応じた）" : "（断った）";
  switch (t.kind) {
    case "claim":
      return ` から聞いた ${fact}`;
    case "urge":
      return ` に ${ix.name(t.about)} 支持を迫られた`;
    case "request":
      return ` に王への報告を頼まれた ${fact}${ans}`;
    case "threat":
      return ` に脅された ${fact} → ${ix.name(t.candidate)} を支持せよ${ans}`;
    case "silence":
      return ` に口止めされた ${fact}${ans}`;
    case "accusation":
      return ` が宮廷で告発した ${fact}`;
    case "sighting":
      return ` から、${ix.name(t.about)} の訪問先を聞いた`;
  }
}

const TRUST = ["distrust", "wary", "neutral", "trusting", "fully"];

export function PersonPanel({ ix, id, day }: { ix: Index; id: Id; day: number }) {
  const p = ix.world.people[id];
  if (!p) return null;
  const snapDay = day === 0 ? (ix.days.at(-1) ?? 0) : day;
  const mind = ix.snapshotAt(snapDay).minds[id];
  const initial = ix.snapshotAt(0).minds[id];
  // 証言はスナップショットに無いので最終状態から、選択日までのものを出す
  const testimony = (ix.world.minds[id]?.testimony ?? []).filter((t) => t.day <= snapDay);
  const trust = Object.entries(mind?.trust ?? {}).sort((a, b) => b[1] - a[1]);
  return (
    <div className="detail">
      <div className="muted small">
        {p.role} · day {snapDay} 時点
      </div>
      <h2 className="person-name">
        {p.protagonist ? "★ " : ""}
        {p.name}
      </h2>
      {mind && (
        <p>
          支持:{" "}
          <span className="tag" style={{ background: ix.color(mind.support) }}>
            {ix.name(mind.support)}
          </span>
        </p>
      )}
      <dl className="kv">
        <dt>公開</dt>
        <dd>{p.publicTraits}</dd>
        <dt>秘密</dt>
        <dd>{p.hiddenTraits}</dd>
        <dt>目的</dt>
        <dd>{p.goals}</dd>
      </dl>
      {mind?.opinions && Object.keys(mind.opinions).length > 0 && (
        <>
          <h3>候補の評価（0 unfit 〜 4 best）</h3>
          <div className="dist">
            {ix.candidates.map((c) => {
              const v = mind.opinions[c] ?? 0;
              const d = v - (initial?.opinions?.[c] ?? v);
              return (
                <div className="dist-row" key={c}>
                  <span className="dist-label">{ix.name(c)}</span>
                  <span className="dist-bar">
                    <span style={{ width: `${(v / 4) * 100}%`, background: ix.color(c) }} />
                  </span>
                  <span className="dist-value">
                    {v.toFixed(1)}
                    {Math.abs(d) >= 0.05 && (
                      <span className={d > 0 ? "up" : "down"}>
                        {" "}
                        {d > 0 ? `+${d.toFixed(1)}` : d.toFixed(1)}
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </>
      )}
      <h3>知っていること</h3>
      <ul className="knowledge">
        {(mind?.knowledge ?? []).map((k) => (
          <li key={k.factId}>
            {ix.world.facts[k.factId]?.text ?? k.factId}
            <span className="muted small">
              {" "}
              {k.source === "self"
                ? "（元から知っている）"
                : `（${ix.name(k.source)} から day ${k.day}、信 ${k.belief.toFixed(2)}）`}
            </span>
          </li>
        ))}
      </ul>
      {testimony.length > 0 && (
        <>
          <h3>受けた主張と説得</h3>
          <ul className="knowledge">
            {testimony.map((t) => (
              <li key={t.eventId}>
                <span className="muted small">day {t.day} </span>
                {ix.name(t.from)}
                {testimonyText(ix, t)}
              </li>
            ))}
          </ul>
        </>
      )}
      <h3>信頼</h3>
      <div className="dist">
        {trust.map(([other, t]) => {
          const d = t - (initial?.trust[other] ?? t);
          return (
            <div className="dist-row" key={other}>
              <span className="dist-label">{ix.name(other)}</span>
              <span className="dist-bar">
                <span style={{ width: `${(t / 4) * 100}%`, background: "var(--accent)" }} />
              </span>
              <span className="dist-value" title={TRUST[Math.round(t)]}>
                {t.toFixed(1)}
                {d !== 0 && (
                  <span className={d > 0 ? "up" : "down"}> {d > 0 ? `+${d.toFixed(1)}` : d.toFixed(1)}</span>
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
