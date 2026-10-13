"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { AboutFields, IdentityFields, PersonalityFields, type AgentForm } from "./AgentFields";

const TABS = ["Aparência e voz", "Personalidade", "Sobre você"] as const;

export function AgentSettings({ initial }: { initial: AgentForm }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [tab, setTab] = useState<(typeof TABS)[number]>(TABS[0]);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<AgentForm>) => setForm((f) => ({ ...f, ...p }));

  async function save() {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/agent", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    const j = await res.json().catch(() => ({}));
    setBusy(false);
    setMsg(res.ok ? { ok: true, text: "Salvo. A próxima conversa já usa essas escolhas." } : { ok: false, text: j.error ?? "Erro ao salvar." });
    if (res.ok) router.refresh();
  }

  return (
    <div className="card !p-6 md:!p-8">
      <div role="tablist" className="flex gap-1.5 mb-7 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-full text-sm font-semibold whitespace-nowrap ${tab === t ? "bg-active text-white" : "bg-sand-deep text-ink-soft"}`}>{t}</button>
        ))}
      </div>
      {tab === TABS[0] && <IdentityFields form={form} set={set} />}
      {tab === TABS[1] && <PersonalityFields form={form} set={set} />}
      {tab === TABS[2] && <AboutFields form={form} set={set} />}
      <div className="mt-8 flex items-center gap-4">
        <button className="btn btn-primary" onClick={save} disabled={busy || !form.agent_name.trim() || !form.preferred_name.trim()}>{busy ? "Salvando…" : "Salvar alterações"}</button>
        {msg && <span role="status" className={`text-sm ${msg.ok ? "text-teal-deep" : "text-coral-ink"}`}>{msg.text}</span>}
      </div>
    </div>
  );
}
