"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

const post = (url: string, body?: unknown) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });

export function TwoFactorLogin({ initialError = "" }: { initialError?: string }) {
  const router = useRouter();
  const [err, setErr] = useState(initialError);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await post("/api/auth/2fa", { code: new FormData(e.currentTarget).get("code") });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setErr(j.error ?? "Erro");
      setBusy(false);
      return;
    }
    router.push(j.next);
    router.refresh();
  }
  return (
    <form onSubmit={submit} method="post" action="/api/auth/2fa" className="space-y-4">
      <div><label className="label" htmlFor="code">Código do aplicativo autenticador</label>
        <input id="code" name="code" className="input text-center text-2xl tracking-[0.4em]" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus /></div>
      {err && <p role="alert" className="text-sm text-[#b4401f] bg-coral-soft rounded-xl px-3 py-2">{err}</p>}
      <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Verificando…" : "Confirmar"}</button>
    </form>
  );
}

export function TwoFactorSetup({ enabled }: { enabled: boolean }) {
  const router = useRouter();
  const [qr, setQr] = useState<{ svg: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    const r = await post("/api/admin/2fa/setup");
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) setQr({ svg: j.qr, secret: j.secret });
    else setMsg({ ok: false, t: j.error ?? "Erro" });
  }
  async function enable() {
    setBusy(true);
    const r = await post("/api/admin/2fa/enable", { code });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.ok) {
      setQr(null);
      setCode("");
      setMsg({ ok: true, t: "2FA ativado. Guarde o aplicativo autenticador com cuidado." });
      router.refresh();
    } else setMsg({ ok: false, t: j.error ?? "Erro" });
  }
  async function disable() {
    if (!confirm("Desativar a verificação em duas etapas? A conta ficará menos protegida.")) return;
    const r = await post("/api/admin/2fa/disable", { password: pw, code });
    const j = await r.json().catch(() => ({}));
    if (r.ok) {
      setPw("");
      setCode("");
      setMsg({ ok: true, t: "2FA desativado." });
      router.refresh();
    } else setMsg({ ok: false, t: j.error ?? "Erro" });
  }

  return (
    <div className="space-y-4">
      {!enabled && !qr && <button className="btn btn-primary" onClick={start} disabled={busy}>Ativar 2FA</button>}
      {qr && (
        <div className="grid sm:grid-cols-[220px_1fr] gap-6 items-start">
          {/* SVG gerado no servidor a partir do segredo (qrcode) */}
          <div className="bg-white rounded-xl border border-line p-2" dangerouslySetInnerHTML={{ __html: qr.svg }} />
          <div className="space-y-3 text-sm">
            <p>1. Abra o Google Authenticator, Authy ou 1Password e escaneie o QR code.</p>
            <p className="text-muted">Sem câmera? Digite a chave: <code className="font-mono break-all">{qr.secret}</code></p>
            <p>2. Digite o código de 6 dígitos:</p>
            <div className="flex gap-2"><input className="input !w-40 text-center tracking-[0.3em]" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /><button className="btn btn-primary" disabled={code.length !== 6 || busy} onClick={enable}>Confirmar</button></div>
          </div>
        </div>
      )}
      {enabled && (
        <div className="space-y-3">
          <p className="text-sm text-teal-deep font-semibold">✓ Verificação em duas etapas ativa.</p>
          <details><summary className="cursor-pointer text-sm text-muted">Desativar…</summary>
            <div className="mt-3 flex flex-wrap gap-2"><input className="input !w-56" type="password" placeholder="Senha atual" value={pw} onChange={(e) => setPw(e.target.value)} /><input className="input !w-36 text-center" inputMode="numeric" maxLength={6} placeholder="Código" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} /><button className="btn btn-danger" onClick={disable}>Desativar</button></div>
          </details>
        </div>
      )}
      {msg && <p role="status" className={`text-sm ${msg.ok ? "text-teal-deep" : "text-[#b4401f]"}`}>{msg.t}</p>}
    </div>
  );
}

export function PasswordForm() {
  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await post("/api/account/password", { current: cur, next });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    setMsg(r.ok ? { ok: true, t: "Senha alterada. Os outros dispositivos foram desconectados." } : { ok: false, t: j.error ?? "Erro" });
    if (r.ok) {
      setCur("");
      setNext("");
    }
  }
  return (
    <form onSubmit={submit} className="grid sm:grid-cols-2 gap-3 max-w-xl">
      <div><label className="label" htmlFor="cur">Senha atual</label><input id="cur" type="password" className="input" value={cur} onChange={(e) => setCur(e.target.value)} autoComplete="current-password" required /></div>
      <div><label className="label" htmlFor="nxt">Nova senha</label><input id="nxt" type="password" className="input" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={10} required /></div>
      <div className="sm:col-span-2 flex items-center gap-3"><button className="btn btn-dark" disabled={busy}>Alterar senha</button>{msg && <span role="status" className={`text-sm ${msg.ok ? "text-teal-deep" : "text-[#b4401f]"}`}>{msg.t}</span>}</div>
    </form>
  );
}
