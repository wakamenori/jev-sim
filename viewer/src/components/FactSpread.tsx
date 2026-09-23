import type { Id, Index } from "../lib/model.ts";

/** 事実 × 日 で、知っている人数の推移。選択日の知っている人を並べる */
export function FactSpread({ ix, day, onPerson }: { ix: Index; day: number; onPerson: (id: Id) => void }) {
  const days = [0, ...ix.days];
  const snapDay = day === 0 ? (ix.days.at(-1) ?? 0) : day;
  const knowers = (factId: Id, d: number) =>
    Object.entries(ix.snapshotAt(d).minds).filter(([, m]) => m.knowledge.some((k) => k.factId === factId));
  return (
    <div className="scroll-x">
      <table className="matrix facts">
        <thead>
          <tr>
            <th>事実</th>
            {days.map((d) => (
              <th key={d} className={d === day ? "current" : ""}>
                {d === 0 ? "初" : d}
              </th>
            ))}
            <th>day {snapDay} に知っている人</th>
          </tr>
        </thead>
        <tbody>
          {Object.values(ix.world.facts).map((f) => (
            <tr key={f.id}>
              <th className="fact-text" title={f.text}>
                {f.text}
              </th>
              {days.map((d) => {
                const n = knowers(f.id, d).length;
                const prev = d > 0 ? knowers(f.id, d - 1).length : n;
                return (
                  <td key={d} className={`count${d === day ? " current" : ""}${n > prev ? " grew" : ""}`}>
                    {n}
                  </td>
                );
              })}
              <td className="knowers">
                {knowers(f.id, snapDay).map(([id, m]) => {
                  const k = m.knowledge.find((x) => x.factId === f.id);
                  return (
                    <button type="button" key={id} className="link small" onClick={() => onPerson(id)}>
                      {ix.name(id)}
                      {k && k.source !== "self" ? `(${k.belief.toFixed(1)})` : ""}
                    </button>
                  );
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
