import type { Event, Id, Index } from "../lib/model.ts";

interface Props {
  ix: Index;
  day: number;
  person?: Id;
  hiddenKinds: Set<string>;
  selected?: number;
  /** 選択中の event の因果の鎖に含まれる id */
  chain: Set<number>;
  onSelect: (e: Event) => void;
  onToggleKind: (k: string) => void;
}

export function Timeline({ ix, day, person, hiddenKinds, selected, chain, onSelect, onToggleKind }: Props) {
  const events = ix.world.events.filter(
    (e) =>
      (day === 0 || e.day === day) &&
      !hiddenKinds.has(e.kind) &&
      (!person || e.actor === person || e.target === person),
  );
  const counts = new Map<string, number>();
  for (const e of ix.world.events)
    if (day === 0 || e.day === day) counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
  return (
    <div className="timeline">
      <div className="kind-filter">
        {ix.kinds.map((k) => (
          <button
            type="button"
            key={k}
            className={`chip${hiddenKinds.has(k) ? " off" : ""}`}
            onClick={() => onToggleKind(k)}
          >
            {k} <span className="muted">{counts.get(k) ?? 0}</span>
          </button>
        ))}
      </div>
      <div className="muted small">{events.length} 件</div>
      <ol className="events">
        {events.map((e) => (
          <li key={e.id}>
            <button
              type="button"
              className={`event kind-${e.kind}${e.id === selected ? " selected" : ""}${chain.has(e.id) ? " in-chain" : ""}`}
              onClick={() => onSelect(e)}
            >
              <span className="event-id">
                d{e.day} #{e.id}
              </span>
              <span className="event-kind">{e.kind}</span>
              <span className="event-text">{e.text}</span>
              {e.causes.length > 0 && (
                <span className="muted small">← {e.causes.map((c) => `#${c}`).join(" ")}</span>
              )}
              {(ix.effects.get(e.id)?.length ?? 0) > 0 && (
                <span className="muted small">→ {ix.effects.get(e.id)?.length}件</span>
              )}
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
