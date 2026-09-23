import type { Index } from "../lib/model.ts";

interface Props {
  ix: Index;
  dist: Record<string, number>;
  /** 実際に選ばれた候補。強調表示する */
  chosen?: string;
  limit?: number;
}

export function Distribution({ ix, dist, chosen, limit = 8 }: Props) {
  const entries = Object.entries(dist).sort((a, b) => b[1] - a[1]);
  const shown = entries.slice(0, limit);
  const rest = entries.length - shown.length;
  return (
    <div className="dist">
      {shown.map(([k, p]) => (
        <div key={k} className={`dist-row${k === chosen ? " chosen" : ""}`} title={k}>
          <span className="dist-label">{ix.name(k)}</span>
          <span className="dist-bar">
            <span style={{ width: `${p * 100}%`, background: ix.color(k) }} />
          </span>
          <span className="dist-value">{p.toFixed(2)}</span>
        </div>
      ))}
      {rest > 0 && <div className="muted small">ほか {rest} 件（いずれも下位）</div>}
    </div>
  );
}
