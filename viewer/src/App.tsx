import { useEffect, useMemo, useState } from "react";
import { EventDetail } from "./components/EventDetail.tsx";
import { FactSpread } from "./components/FactSpread.tsx";
import { KingChart } from "./components/KingChart.tsx";
import { PersonPanel } from "./components/PersonPanel.tsx";
import { PlayerView } from "./components/PlayerView.tsx";
import { SupportMatrix } from "./components/SupportMatrix.tsx";
import { Timeline } from "./components/Timeline.tsx";
import { ancestry, buildIndex, descendants, type Event, heirOf, type Id, type World } from "./lib/model.ts";

/** out/runs 以下のログ。新しい順 */
const runLoaders = import.meta.glob<World>("../../out/runs/*.json", { import: "default" });
const runPaths = Object.keys(runLoaders).sort().reverse();
const label = (path: string) =>
  path
    .split("/")
    .pop()
    ?.replace(/\.json$/, "") ?? path;

const DEFAULT_HIDDEN = new Set(["assess"]);

export function App() {
  const [runPath, setRunPath] = useState<string | undefined>(runPaths[0]);
  const [world, setWorld] = useState<World>();
  const [error, setError] = useState<string>();
  const [day, setDay] = useState(1);
  const [person, setPerson] = useState<Id>();
  const [eventId, setEventId] = useState<number>();
  const [hiddenKinds, setHiddenKinds] = useState<Set<string>>(DEFAULT_HIDDEN);
  // 遊ぶ画面（主人公が知っていることだけ）と、開発用の画面（全員の内面と分布）
  const [mode, setMode] = useState<"player" | "dev">("player");

  useEffect(() => {
    if (!runPath) return;
    const load = runLoaders[runPath];
    if (!load) return;
    load()
      .then((w) => {
        setWorld(w);
        setError(undefined);
        setEventId(undefined);
      })
      .catch((e: unknown) => setError(String(e)));
  }, [runPath]);

  const ix = useMemo(() => (world ? buildIndex(world) : undefined), [world]);
  const event = eventId !== undefined ? ix?.eventById.get(eventId) : undefined;
  const chain = useMemo(() => {
    if (!ix || eventId === undefined) return new Set<number>();
    return new Set([...ancestry(ix, eventId), ...descendants(ix, eventId)].map(([e]) => e.id));
  }, [ix, eventId]);

  const openFile = async (file: File) => {
    try {
      setWorld(JSON.parse(await file.text()) as World);
      setRunPath(undefined);
      setError(undefined);
    } catch (e) {
      setError(`読み込めませんでした: ${String(e)}`);
    }
  };

  const selectEvent = (e: Event) => {
    setEventId(e.id);
    setDay(e.day);
  };

  // ← → で日を移動
  useEffect(() => {
    const max = ix?.days.length ?? 0;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === "ArrowLeft") setDay((d) => Math.max(0, d - 1));
      if (e.key === "ArrowRight") setDay((d) => Math.min(max, d + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [ix]);

  const heir = world ? heirOf(world) : undefined;
  const protagonist = world ? Object.values(world.people).find((p) => p.protagonist)?.id : undefined;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: ファイルのドロップ受け付け
    <div
      className="app"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const f = e.dataTransfer.files[0];
        if (f) void openFile(f);
      }}
    >
      <header className="topbar">
        <h1>Court Viewer</h1>
        <div className="days">
          <button type="button" className={mode === "player" ? "on" : ""} onClick={() => setMode("player")}>
            主人公の視点
          </button>
          <button type="button" className={mode === "dev" ? "on" : ""} onClick={() => setMode("dev")}>
            開発用（全体）
          </button>
        </div>
        <select value={runPath ?? ""} onChange={(e) => setRunPath(e.target.value || undefined)}>
          {!runPath && <option value="">（ファイルから読み込み）</option>}
          {runPaths.map((p) => (
            <option key={p} value={p}>
              {label(p)}
            </option>
          ))}
        </select>
        <label className="file">
          開く…
          <input
            type="file"
            accept="application/json"
            onChange={(e) => e.target.files?.[0] && openFile(e.target.files[0])}
          />
        </label>
        {ix && heir && mode === "dev" && (
          <div className="result">
            指名:{" "}
            <span className="tag" style={{ background: ix.color(heir.heir) }}>
              {ix.name(heir.heir)}
            </span>
            {heir.probabilities && (
              <span className="muted small">
                {" "}
                {Object.entries(heir.probabilities)
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, p]) => `${ix.name(k)} ${p.toFixed(2)}`)
                  .join(" / ")}
              </span>
            )}
          </div>
        )}
        {world?.meta && (
          <div className="muted small meta">
            {world.meta.model} ·{" "}
            {world.meta.jev ? `calls ${world.meta.jev.calls} / cache ${world.meta.jev.cacheHits}` : ""}
          </div>
        )}
      </header>

      {error && <div className="error">{error}</div>}
      {!runPaths.length && !world && (
        <div className="empty">
          out/runs/ にログがありません。<code>pnpm baseline</code> を実行するか、JSON
          をここへドロップしてください。
        </div>
      )}

      {ix && (
        <>
          <nav className="days">
            <button type="button" className={day === 0 ? "on" : ""} onClick={() => setDay(0)}>
              全日
            </button>
            {ix.days.map((d) => (
              <button type="button" key={d} className={day === d ? "on" : ""} onClick={() => setDay(d)}>
                {d}
              </button>
            ))}
            <span className="muted small">← → で移動</span>
          </nav>
          {mode === "player" && protagonist ? (
            <PlayerView ix={ix} pid={protagonist} day={day} />
          ) : (
            <main className="layout">
              <section className="col overview">
                <h2>王の評価</h2>
                <KingChart ix={ix} day={day} onDay={setDay} />
                <h2>支持の推移</h2>
                <SupportMatrix
                  ix={ix}
                  day={day}
                  person={person}
                  onSelect={(p, d) => {
                    setPerson(p === person && d === day ? undefined : p);
                    setDay(d);
                  }}
                />
                <h2>情報の広がり</h2>
                <FactSpread ix={ix} day={day} onPerson={setPerson} />
              </section>
              <section className="col">
                <h2>
                  出来事{day ? ` · day ${day}` : " · 全日"}
                  {person && (
                    <button type="button" className="chip" onClick={() => setPerson(undefined)}>
                      {ix.name(person)} ×
                    </button>
                  )}
                </h2>
                <Timeline
                  ix={ix}
                  day={day}
                  person={person}
                  hiddenKinds={hiddenKinds}
                  selected={eventId}
                  chain={chain}
                  onSelect={selectEvent}
                  onToggleKind={(k) =>
                    setHiddenKinds((s) => {
                      const n = new Set(s);
                      if (n.has(k)) n.delete(k);
                      else n.add(k);
                      return n;
                    })
                  }
                />
              </section>
              <aside className="col inspector">
                {event && (
                  <>
                    <h2>
                      出来事の詳細
                      <button type="button" className="chip" onClick={() => setEventId(undefined)}>
                        ×
                      </button>
                    </h2>
                    <EventDetail ix={ix} event={event} onSelect={selectEvent} />
                  </>
                )}
                {person && (
                  <>
                    <h2>人物</h2>
                    <PersonPanel ix={ix} id={person} day={day} />
                  </>
                )}
                {!event && !person && <div className="muted small">出来事か人物を選ぶと詳細が出ます。</div>}
              </aside>
            </main>
          )}
        </>
      )}
    </div>
  );
}
