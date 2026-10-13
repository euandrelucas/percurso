"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "./icons";

const post = (url: string, body?: unknown, method = "POST") => fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });

export function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button className="text-xs font-semibold text-teal-deep hover:underline" onClick={async () => { await navigator.clipboard.writeText(text.startsWith("/") ? window.location.origin + text : text).catch(() => {}); setOk(true); setTimeout(() => setOk(false), 1500); }}>{ok ? <span className="inline-flex items-center gap-1">Copiado <Icon name="check" size={13} strokeWidth={3} /></span> : label}</button>
  );
}

export function InviteForm({ appUrl }: { appUrl: string }) {
  const router = useRouter();
  const [label, setLabel] = useState("");
  const [count, setCount] = useState(1);
  const [days, setDays] = useState(0);
  const [codes, setCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  async function gen(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await post("/api/admin/invites", { label, count, expiresInDays: days || undefined });
    const j = await r.json();
    setBusy(false);
    if (r.ok) { setCodes(j.codes); setLabel(""); router.refresh(); }
  }
  return (
    <div className="card">
      <h2 className="text-xl font-semibold mb-4">Gerar convites</h2>
      <form onSubmit={gen} className="grid sm:grid-cols-[1fr_110px_150px_auto] gap-3 items-end">
        <div><label className="label" htmlFor="l">Para quem é? (anotação sua)</label><input id="l" className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ex.: João (faculdade)" maxLength={80} /></div>
        <div><label className="label" htmlFor="c">Quantidade</label><input id="c" type="number" min={1} max={20} className="input" value={count} onChange={(e) => setCount(Number(e.target.value))} /></div>
        <div><label className="label" htmlFor="d">Expira em (dias)</label><input id="d" type="number" min={0} className="input" value={days} onChange={(e) => setDays(Number(e.target.value))} placeholder="0 = nunca" /></div>
        <button className="btn btn-primary" disabled={busy}>{busy ? "Gerando…" : "Gerar"}</button>
      </form>
      {codes.length > 0 && (
        <div className="mt-4 rounded-xl bg-teal-soft p-4">
          <p className="text-sm font-semibold mb-2">Códigos gerados — envie para seus amigos:</p>
          <ul className="space-y-1.5">{codes.map((c) => <li key={c} className="flex items-center gap-3 flex-wrap"><code className="font-mono text-lg tracking-widest">{c}</code><CopyButton text={c} /><CopyButton text={`${appUrl}/cadastro?code=${c}`} label="Copiar link" /></li>)}</ul>
        </div>
      )}
    </div>
  );
}

export function RevokeInvite({ id }: { id: number }) {
  const router = useRouter();
  return <button className="text-xs text-coral-ink hover:underline" onClick={async () => { if (!confirm("Revogar este convite?")) return; await post("/api/admin/invites", { id }, "DELETE"); router.refresh(); }}>revogar</button>;
}

export function AlertActions({ id, status }: { id: number; status: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [open, setOpen] = useState(false);
  async function set(s: string) {
    await post(`/api/admin/alerts/${id}`, { status: s, note });
    setOpen(false);
    router.refresh();
  }
  if (status === "resolvido") return <span className="text-xs text-muted">resolvido</span>;
  return (
    <div className="mt-2">
      {!open ? (
        <div className="flex gap-3 text-sm">
          {status === "aberto" && <button className="font-semibold text-teal-deep" onClick={() => set("em_acompanhamento")}>Assumir acompanhamento</button>}
          <button className="font-semibold text-ink-soft" onClick={() => setOpen(true)}>Resolver…</button>
        </div>
      ) : (
        <div className="space-y-2">
          <textarea className="input text-sm" rows={2} placeholder="O que foi feito? (contato, encaminhamento…)" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2"><button className="btn btn-primary !py-1.5 !px-4 text-sm" onClick={() => set("resolvido")}>Marcar resolvido</button><button className="btn btn-ghost !py-1.5 !px-4 text-sm" onClick={() => setOpen(false)}>Cancelar</button></div>
        </div>
      )}
    </div>
  );
}

export function PatientActions({ id, status, callsPerDay, hasReport }: { id: number; status: string; callsPerDay: number | null; hasReport: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [transcripts, setTranscripts] = useState(true);
  const [limit, setLimit] = useState<string>(callsPerDay === null ? "" : String(callsPerDay));
  const qs = transcripts ? "" : "&transcripts=0";
  async function report() {
    setBusy(true);
    setErr("");
    const r = await post(`/api/admin/users/${id}/report`);
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(j.error ?? "Erro");
    router.refresh();
    window.location.href = `/api/admin/users/${id}/pdf?report=${j.reportId}${qs}`;
  }
  return (
    <div className="card space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button className="btn btn-primary" onClick={report} disabled={busy}>{busy ? "Gerando dossiê… (pode levar ~1 min)" : "Gerar dossiê completo (PDF)"}</button>
        {hasReport && <a className="btn btn-ghost" href={`/api/admin/users/${id}/pdf?x=1${qs}`}>Baixar último dossiê</a>}
        <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" className="accent-teal w-4 h-4" checked={transcripts} onChange={(e) => setTranscripts(e.target.checked)} />incluir transcrições completas</label>
        {err && <span className="text-sm text-coral-ink">{err}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-line">
        <label className="flex items-center gap-2 text-sm text-muted">Chamadas por dia
          <input className="input !w-20 !py-1.5" type="number" min={0} max={10} placeholder="padrão" value={limit} onChange={(e) => setLimit(e.target.value)} onBlur={async () => { await post(`/api/admin/users/${id}`, { action: "calls_per_day", value: limit === "" ? null : Number(limit) }); router.refresh(); }} />
        </label>
        <button className="btn btn-ghost !py-1.5 text-sm" onClick={async () => { if (status === "active" && !confirm("Suspender o acesso deste paciente? Ele será desconectado.")) return; await post(`/api/admin/users/${id}`, { action: status === "active" ? "suspend" : "reactivate" }); router.refresh(); }}>{status === "active" ? "Suspender acesso" : "Reativar acesso"}</button>
      </div>
    </div>
  );
}

export function ReanalyzeButton({ id }: { id: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return <button className="text-xs text-teal-deep font-semibold hover:underline" disabled={busy} onClick={async () => { setBusy(true); await post(`/api/admin/sessions/${id}/analyze`); setBusy(false); router.refresh(); }}>{busy ? "Analisando…" : "reanalisar"}</button>;
}
