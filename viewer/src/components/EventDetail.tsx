import { ancestry, descendants, type Event, type Index } from "../lib/model.ts";
import { EventData } from "./EventData.tsx";

interface Props {
  ix: Index;
  event: Event;
  onSelect: (e: Event) => void;
}

export function EventDetail({ ix, event, onSelect }: Props) {
  const up = ancestry(ix, event.id).slice(1);
  const down = descendants(ix, event.id);
  const fact = event.factId ? ix.world.facts[event.factId] : undefined;
  const chosen: Record<string, string> = {};
  // meet の場合、実際に選ばれた相手を分布の中で強調する
  if (event.kind === "meet" && event.target) chosen.approach = event.target;
  return (
    <div className="detail">
      <div className="muted small">
        day {event.day} · #{event.id} · {event.kind}
      </div>
      <p className="detail-text">{event.text}</p>
      <dl className="kv">
        <dt>主体</dt>
        <dd>{ix.name(event.actor)}</dd>
        {event.target && (
          <>
            <dt>相手</dt>
            <dd>{ix.name(event.target)}</dd>
          </>
        )}
        {fact && (
          <>
            <dt>事実</dt>
            <dd>{fact.text}</dd>
          </>
        )}
      </dl>
      {up.length > 0 && <Chain title="原因" items={up} onSelect={onSelect} />}
      {down.length > 0 && <Chain title="結果" items={down} onSelect={onSelect} />}
      <h3>Jev の出力</h3>
      <EventData ix={ix} data={event.data} chosen={chosen} />
    </div>
  );
}

function Chain({
  title,
  items,
  onSelect,
}: {
  title: string;
  items: [Event, number][];
  onSelect: (e: Event) => void;
}) {
  return (
    <>
      <h3>{title}</h3>
      <ul className="chain">
        {items.map(([e, depth]) => (
          <li key={e.id} style={{ paddingLeft: `${depth * 1}rem` }}>
            <button type="button" className="link" onClick={() => onSelect(e)}>
              #{e.id}
            </button>{" "}
            {e.text}
          </li>
        ))}
      </ul>
    </>
  );
}
