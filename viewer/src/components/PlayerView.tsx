import type { Id, Index } from "../lib/model.ts";

/**
 * 遊ぶ画面。主人公（Lysander）が知っていることだけを日ごとに見せる。
 * 他人の内面や Jev の確率分布は見せない。
 */
export function PlayerView({ ix, pid, day }: { ix: Index; pid: Id; day: number }) {
  const w = ix.world;
  const m = w.minds[pid];
  const d = day === 0 ? (ix.days.at(-1) ?? 1) : day;
  const snap = ix.snapshotAt(d).minds[pid];
  const facts = (id: Id) => w.facts[id]?.text ?? id;

  const actions = m.actionLog.filter((a) => a.day === d);
  const heard = m.testimony.filter((t) => t.day === d);
  const visits = m.sightings.filter((s) => s.day === d);
  const reports = m.reports.filter((r) => r.day === d);
  const plan = w.plans.find((p) => p.day === d && p.lead === pid);
  const heir = [...w.events].reverse().find((e) => e.kind === "name_heir");
  const isLast = d === (ix.days.at(-1) ?? 0);

  return (
    <div className="player">
      <section className="col">
        <h2>
          {ix.name(pid)} の {d} 日目
        </h2>
        {plan && (
          <div className="detail">
            <h3>自陣営の計画（あなたが立てた）</h3>
            <p className="small">{plan.assessment}</p>
            <ul className="chain">
              {plan.aims.map((a) => (
                <li key={a}>・{a}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="detail">
          <h3>あなたの行動と、見えた反応</h3>
          <ul className="chain">
            {actions.map((a) => (
              <li key={`${a.turn}${a.action}`}>
                <span className="muted small">{a.turn} 手目 </span>
                {a.action} → <span className="muted">{a.outcome}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="detail">
          <h3>人から聞いたこと・頼まれたこと</h3>
          <ul className="chain">
            {heard.length === 0 && <li className="muted small">なし</li>}
            {heard.map((t) => (
              <li key={t.eventId}>
                {ix.name(t.from)}（{t.kind}）{t.kind === "urge" ? ix.name(t.about) : facts(t.about)}
                {t.agreed !== undefined && (
                  <span className="muted small">{t.agreed ? " 応じた" : " 断った"}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
        <div className="detail">
          <h3>知った訪問</h3>
          <ul className="chain">
            {visits.length === 0 && <li className="muted small">なし</li>}
            {visits.map((s) => (
              <li key={`${s.turn}${s.visitor}${s.host}${s.source}`}>
                {ix.name(s.visitor)} → {ix.name(s.host)}
                <span className="muted small">
                  {" "}
                  （{s.source === "self" ? "自分で見た" : `${ix.name(s.source)} から`}）
                </span>
              </li>
            ))}
          </ul>
        </div>
        {reports.length > 0 && (
          <div className="detail">
            <h3>陣営からの報告</h3>
            {reports.map((r) => (
              <div key={r.from}>
                <h4>{ix.name(r.from)}</h4>
                <ul className="chain small">
                  {r.lines.map((l) => (
                    <li key={l}>・{l}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
        {isLast && heir && (
          <div className="detail">
            <h3>結末</h3>
            <p>{heir.text}</p>
          </div>
        )}
      </section>
      <aside className="col">
        <h2>あなたの推測（{d} 日目の終わり）</h2>
        <table className="matrix">
          <tbody>
            {Object.keys(w.people)
              .filter((id) => id !== pid && !ix.judges.has(id) && !w.people[id].candidate)
              .map((id) => {
                const b = snap?.beliefs?.[id];
                const s = b?.support ?? "unknown";
                return (
                  <tr key={id}>
                    <th>{ix.name(id)}</th>
                    <td>
                      <span className="tag" style={{ background: ix.color(s) }}>
                        {s === "unknown" ? "不明" : s === "undecided" ? "未定" : ix.name(s)}
                      </span>
                    </td>
                    <td className="muted small">{b?.note}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
        <h2>知っている事実</h2>
        <ul className="knowledge">
          {(snap?.knowledge ?? []).map((k) => (
            <li key={k.factId}>
              {facts(k.factId)}
              <span className="muted small">
                {" "}
                {k.source === "self"
                  ? "（元から知っている）"
                  : `（${ix.name(k.source)} から、信 ${k.belief.toFixed(1)}）`}
              </span>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
