import type { Index } from "../lib/model.ts";

const W = 520;
const H = 180;
const PAD = { l: 28, r: 12, t: 12, b: 22 };
const LEVELS = ["unfit", "doubtful", "acceptable", "good", "best"];

export function KingChart({ ix, day, onDay }: { ix: Index; day: number; onDay: (d: number) => void }) {
  const series = ix.world.kingSuitability;
  if (!series?.length) return <div className="muted small">王の評価データなし</div>;
  const n = series.length;
  const x = (i: number) => PAD.l + (n === 1 ? 0 : (i / (n - 1)) * (W - PAD.l - PAD.r));
  const dayNums = series.map((_, i) => i + 1);
  const y = (v: number) => PAD.t + (1 - v / 4) * (H - PAD.t - PAD.b);
  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="王による各候補の適性評価の推移">
        {LEVELS.map((label, lv) => (
          <g key={label}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(lv)} y2={y(lv)} className="grid" />
            <text x={PAD.l - 4} y={y(lv) + 3} className="axis" textAnchor="end">
              {lv}
            </text>
          </g>
        ))}
        {dayNums.map((d) => (
          // biome-ignore lint/a11y/noStaticElementInteractions: SVG 上の日付選択
          <g key={d} onClick={() => onDay(d)} className="day-hit">
            <rect x={x(d - 1) - 10} y={PAD.t} width={20} height={H - PAD.t - PAD.b} />
            <text x={x(d - 1)} y={H - 6} className={`axis${day === d ? " current" : ""}`} textAnchor="middle">
              {d}
            </text>
          </g>
        ))}
        {day > 0 && day <= n && (
          <line x1={x(day - 1)} x2={x(day - 1)} y1={PAD.t} y2={H - PAD.b} className="cursor" />
        )}
        {ix.candidates.map((c) => (
          <g key={c}>
            <polyline
              fill="none"
              stroke={ix.color(c)}
              strokeWidth={2}
              points={series.map((s, i) => `${x(i)},${y(s[c] ?? 0)}`).join(" ")}
            />
            {dayNums.map((d) => {
              const v = series[d - 1][c] ?? 0;
              return (
                <circle key={d} cx={x(d - 1)} cy={y(v)} r={day === d ? 4 : 2.5} fill={ix.color(c)}>
                  <title>{`${ix.name(c)} day ${d}: ${v.toFixed(2)}`}</title>
                </circle>
              );
            })}
          </g>
        ))}
      </svg>
      <div className="legend">
        {ix.candidates.map((c) => (
          <span key={c}>
            <i style={{ background: ix.color(c) }} />
            {ix.name(c)}
            {day > 0 && series[day - 1] ? ` ${(series[day - 1][c] ?? 0).toFixed(2)}` : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
