import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";
import { fixtureWorld } from "../../tests/fixtures/decisions.ts";
import { EventDetail } from "../src/components/EventDetail.tsx";
import { FactSpread } from "../src/components/FactSpread.tsx";
import { KingChart } from "../src/components/KingChart.tsx";
import { PersonPanel } from "../src/components/PersonPanel.tsx";
import { PlayerView } from "../src/components/PlayerView.tsx";
import { SupportMatrix } from "../src/components/SupportMatrix.tsx";
import { Timeline } from "../src/components/Timeline.tsx";
import { buildIndex, heirOf, type World } from "../src/lib/model.ts";

export async function run(file?: string) {
  const w = file ? (JSON.parse(readFileSync(file, "utf8")) as World) : await fixtureWorld();
  const ix = buildIndex(w);
  const noop = () => {};
  const hear = w.events.find((e) => e.kind === "hear");
  const meet = w.events.find((e) => e.kind === "act");
  const out: Record<string, number> = {};
  const r = (k: string, el: ReactElement) => {
    out[k] = renderToString(el).length;
    assert.ok(out[k] > 0, `${k} rendered empty markup`);
  };
  for (const day of new Set([0, 1, w.totalDays])) {
    r(`king${day}`, <KingChart ix={ix} day={day} onDay={noop} />);
    r(`support${day}`, <SupportMatrix ix={ix} day={day} onSelect={noop} />);
    r(`facts${day}`, <FactSpread ix={ix} day={day} onPerson={noop} />);
    r(
      `timeline${day}`,
      <Timeline
        ix={ix}
        day={day}
        hiddenKinds={new Set()}
        chain={new Set()}
        onSelect={noop}
        onToggleKind={noop}
      />,
    );
    r(`person${day}`, <PersonPanel ix={ix} id="lysander" day={day} />);
    r(`player${day}`, <PlayerView ix={ix} pid="lysander" day={day} />);
  }
  for (const e of [
    hear,
    meet,
    w.events.find((e) => e.kind === "assess"),
    w.events.find((e) => e.kind === "name_heir"),
  ])
    if (e) r(`detail-${e.kind}`, <EventDetail ix={ix} event={e} onSelect={noop} />);
  if (!file) {
    const legacy = structuredClone(w);
    for (const mind of Object.values(legacy.minds)) {
      for (const field of ["actionLog", "testimony", "sightings", "reports"])
        Reflect.deleteProperty(mind, field);
    }
    Reflect.deleteProperty(legacy, "plans");
    r("legacy-player", <PlayerView ix={buildIndex(legacy)} pid="lysander" day={1} />);
  }
  return {
    file: file ?? "generated fixture (no API)",
    snapshots: w.snapshots.length,
    candidates: ix.candidates,
    judges: [...ix.judges],
    heir: heirOf(w)?.heir,
    days: ix.days.length,
    sizes: out,
  };
}
