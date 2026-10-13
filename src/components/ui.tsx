import Link from "next/link";
import type { ReactNode } from "react";

export function Logo({ light = false, href = "/" }: { light?: boolean; href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5" aria-label="Percurso — início">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden>
        <circle cx="16" cy="16" r="16" fill="#0d9488" />
        <path d="M8 21c4-1 5-7 9-7s4 5 7 4" stroke="#fff" strokeWidth="2.6" fill="none" strokeLinecap="round" />
        <circle cx="24" cy="18" r="2" fill="#fff" />
      </svg>
      <span className={`serif text-xl font-semibold ${light ? "text-white" : "text-ink"}`}>Percurso</span>
    </Link>
  );
}

export function CrisisStrip() {
  return (
    <div className="bg-coral-soft text-[13px] text-ink-soft px-4 py-2 text-center border-b border-[#f6d2c9]">
      Em risco ou precisando de ajuda agora? Ligue <strong>188</strong> (CVV, 24h) ou <strong>192</strong> (SAMU).
    </div>
  );
}

export function Stat({ label, value, sub, tone = "default" }: { label: string; value: ReactNode; sub?: string; tone?: "default" | "alert" | "good" }) {
  const c = tone === "alert" ? "text-coral" : tone === "good" ? "text-teal-deep" : "text-ink";
  return (
    <div className="card !p-4">
      <div className="text-[12px] uppercase tracking-wide text-muted font-semibold">{label}</div>
      <div className={`serif text-3xl mt-1 ${c}`}>{value}</div>
      {sub && <div className="text-xs text-muted mt-0.5">{sub}</div>}
    </div>
  );
}

export function PageTitle({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-6">
      <div>
        <h1 className="text-3xl md:text-4xl font-semibold">{title}</h1>
        {sub && <p className="text-muted mt-1.5 max-w-2xl">{sub}</p>}
      </div>
      {action}
    </div>
  );
}

export function Badge({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "good" | "alert" | "warn" | "dark" }) {
  const map = { default: "bg-sand-deep text-ink-soft", good: "bg-teal-soft text-teal-deep", alert: "bg-coral-soft text-[#b4401f]", warn: "bg-amber-soft text-[#8a5a00]", dark: "bg-ink text-white" };
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[tone]}`}>{children}</span>;
}
