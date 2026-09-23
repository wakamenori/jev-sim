import type { Id, Index } from "../lib/model.ts";

interface Props {
  ix: Index;
  day: number;
  person?: Id;
  onSelect: (person: Id, day: number) => void;
}

/** 人 × 日 の支持の推移。支持が変わったセルに印を付ける */
export function SupportMatrix({ ix, day, person, onSelect }: Props) {
  const days = [0, ...ix.days];
  const finalSupport = (id: Id) => ix.snapshotAt(ix.days.at(-1) ?? 0).minds[id]?.support ?? "undecided";
  const order = [...ix.candidates, "undecided"];
  const people = Object.values(ix.world.people)
    .filter((p) => !ix.judges.has(p.id))
    .sort((a, b) => order.indexOf(finalSupport(a.id)) - order.indexOf(finalSupport(b.id)));
  return (
    <div className="scroll-x">
      <table className="matrix">
        <thead>
          <tr>
            <th />
            {days.map((d) => (
              <th key={d} className={d === day ? "current" : ""}>
                {d === 0 ? "初" : d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {people.map((p) => (
            <tr key={p.id} className={p.id === person ? "selected" : ""}>
              <th>
                <button type="button" className="link" onClick={() => onSelect(p.id, day)}>
                  {p.protagonist ? "★ " : ""}
                  {p.name}
                </button>
              </th>
              {days.map((d) => {
                const s = ix.snapshotAt(d).minds[p.id]?.support ?? "undecided";
                const prev = d > 0 ? ix.snapshotAt(d - 1).minds[p.id]?.support : s;
                return (
                  <td key={d} className={d === day ? "current" : ""}>
                    <button
                      type="button"
                      className={`cell${prev !== s ? " switched" : ""}`}
                      style={{ background: ix.color(s) }}
                      title={`${p.name} day ${d}: ${ix.name(s)}`}
                      onClick={() => onSelect(p.id, d)}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
