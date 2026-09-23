import { type Index, isDistribution } from "../lib/model.ts";
import { Distribution } from "./Distribution.tsx";

/**
 * Event.data の汎用表示。構造は今後変わる前提なので、形から判断する。
 * - 確率分布 → 棒
 * - 確率分布を値に持つオブジェクト → 見出し付きの棒
 * - それ以外 → JSON
 */
export function EventData({
  ix,
  data,
  chosen,
}: {
  ix: Index;
  data: unknown;
  chosen?: Record<string, string>;
}) {
  if (data === undefined || data === null) return <div className="muted small">データなし</div>;
  if (isDistribution(data)) return <Distribution ix={ix} dist={data} />;
  if (typeof data === "object" && !Array.isArray(data)) {
    const entries = Object.entries(data);
    if (entries.length > 0 && entries.every(([, v]) => isDistribution(v))) {
      return (
        <div className="dist-group">
          {entries.map(([k, v]) => (
            <section key={k}>
              <h4>{ix.world.people[k] ? ix.name(k) : k}</h4>
              <Distribution ix={ix} dist={v as Record<string, number>} chosen={chosen?.[k]} />
            </section>
          ))}
        </div>
      );
    }
  }
  return <pre className="json">{JSON.stringify(data, null, 2)}</pre>;
}
