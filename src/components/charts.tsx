// Gráficos SVG leves (sem biblioteca) usados no painel admin. Server-component friendly.
import { fmtShort } from "@/lib/time";

type Day = { d: string; n: number };
const TEAL = "#0d9488";
const INK = "#0f1829";
const GRID = "#e6e1d6";
const MUTED = "#657084";

/** Preenche dias sem registro com zero para o eixo X ser contínuo. */
export function fillDays(rows: { d: string; n?: number; v?: number }[], days = 30) {
  const map = new Map(rows.map((r) => [r.d, r]));
  const out: { d: string; n: number; v: number | null }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(Date.now() - i * 864e5));
    const r = map.get(d);
    out.push({ d, n: r?.n ?? 0, v: r?.v ?? null });
  }
  return out;
}

export function BarChart({ data, height = 140, label }: { data: Day[]; height?: number; label: string }) {
  const W = 600;
  const pad = { l: 28, r: 8, t: 8, b: 22 };
  const max = Math.max(3, ...data.map((d) => d.n));
  const bw = (W - pad.l - pad.r) / data.length;
  const ticks = [0, Math.ceil(max / 2), max];
  return (
    <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={label} className="w-full h-auto">
      {ticks.map((t) => {
        const y = pad.t + (height - pad.t - pad.b) * (1 - t / max);
        return (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={y} y2={y} stroke={GRID} strokeWidth="1" />
            <text x={pad.l - 6} y={y + 3} textAnchor="end" fontSize="10" fill={MUTED}>{t}</text>
          </g>
        );
      })}
      {data.map((d, i) => {
        const h = (height - pad.t - pad.b) * (d.n / max);
        return (
          <g key={d.d}>
            <rect x={pad.l + i * bw + 2} y={height - pad.b - h} width={Math.max(2, bw - 4)} height={h} rx="2" fill={TEAL}>
              <title>{`${fmtShort(d.d + "T12:00:00Z")}: ${d.n}`}</title>
            </rect>
            {i % 5 === 0 && <text x={pad.l + i * bw + bw / 2} y={height - 6} textAnchor="middle" fontSize="10" fill={MUTED}>{fmtShort(d.d + "T12:00:00Z")}</text>}
          </g>
        );
      })}
    </svg>
  );
}

export function LineChart({ points, height = 140, label }: { points: { d: string; v: number | null }[]; height?: number; label: string }) {
  const W = 600;
  const pad = { l: 28, r: 8, t: 10, b: 22 };
  const has = points.filter((p) => p.v !== null);
  if (has.length < 2) return <p className="text-sm text-muted py-8 text-center">Ainda não há registros suficientes.</p>;
  const x = (i: number) => pad.l + (i / (points.length - 1)) * (W - pad.l - pad.r);
  const y = (v: number) => pad.t + (height - pad.t - pad.b) * (1 - v / 10);
  // Une os pontos existentes (dias sem registro não quebram a linha).
  const path = points.map((p, i) => (p.v === null ? "" : `${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`)).filter(Boolean).map((c, i) => `${i === 0 ? "M" : "L"}${c}`).join(" ");
  return (
    <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={label} className="w-full h-auto">
      {[0, 5, 10].map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={GRID} />
          <text x={pad.l - 6} y={y(t) + 3} textAnchor="end" fontSize="10" fill={MUTED}>{t}</text>
        </g>
      ))}
      <path d={path} fill="none" stroke={INK} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((p, i) => p.v !== null && (
        <circle key={`${p.d}-${i}`} cx={x(i)} cy={y(p.v)} r="3" fill={TEAL}>
          <title>{`${fmtShort(p.d + "T12:00:00Z")}: ${p.v}`}</title>
        </circle>
      ))}
      {points.map((p, i) => i % Math.max(1, Math.ceil(points.length / 6)) === 0 && <text key={`${p.d}-${i}`} x={x(i)} y={height - 6} textAnchor="middle" fontSize="10" fill={MUTED}>{fmtShort(p.d + "T12:00:00Z")}</text>)}
    </svg>
  );
}

export function Funnel({ steps }: { steps: { label: string; value: number }[] }) {
  const max = Math.max(1, steps[0]?.value ?? 1);
  return (
    <ol className="space-y-2.5">
      {steps.map((s, i) => {
        const prev = i === 0 ? s.value : steps[i - 1].value;
        const conv = prev ? Math.round((s.value / prev) * 100) : 0;
        return (
          <li key={s.label}>
            <div className="flex justify-between text-sm mb-1"><span>{s.label}</span><span className="text-muted">{s.value}{i > 0 && <span className="ml-2 text-teal-deep font-semibold">{conv}%</span>}</span></div>
            <div className="h-2.5 rounded-full bg-sand-deep overflow-hidden"><div className="h-full bg-teal rounded-full" style={{ width: `${(s.value / max) * 100}%` }} /></div>
          </li>
        );
      })}
    </ol>
  );
}
