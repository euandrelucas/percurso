"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Logo } from "./ui";

export function AuthForm({ mode, defaultCode = "", initialError = "" }: { mode: "login" | "register"; defaultCode?: string; initialError?: string }) {
  const router = useRouter();
  const [err, setErr] = useState(initialError);
  const [busy, setBusy] = useState(false);
  const reg = mode === "register";

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const f = Object.fromEntries(new FormData(e.currentTarget));
    const res = await fetch(reg ? "/api/auth/register" : "/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setErr(j.error ?? "Algo deu errado.");
      setBusy(false);
      return;
    }
    router.push(j.next);
    router.refresh();
  }

  return (
    <main className="min-h-dvh grid place-items-center px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="card !p-7 fade-up">
          <h1 className="text-3xl font-semibold">{reg ? "Criar sua conta" : "Bem-vindo de volta"}</h1>
          <p className="text-muted mt-1.5 mb-6 text-sm">{reg ? "Use o código de convite que você recebeu. Ele só funciona uma vez." : "Entre para continuar o seu percurso."}</p>
          {/* method/action: sem JavaScript o formulário ainda funciona (POST + redirecionamento); com JavaScript o onSubmit assume. */}
          <form onSubmit={submit} method="post" action={reg ? "/api/auth/register" : "/api/auth/login"} className="space-y-4">
            {reg && (
              <>
                <div>
                  <label className="label" htmlFor="code">Código de convite</label>
                  <input id="code" name="code" defaultValue={defaultCode} className="input uppercase tracking-widest" placeholder="PERC-XXXX-XXXX" required autoComplete="off" maxLength={40} />
                </div>
                <div>
                  <label className="label" htmlFor="name">Seu nome</label>
                  <input id="name" name="name" className="input" required autoComplete="name" />
                </div>
              </>
            )}
            <div>
              <label className="label" htmlFor="email">E-mail</label>
              <input id="email" name="email" type="email" className="input" required autoComplete="email" />
            </div>
            <div>
              <label className="label" htmlFor="password">Senha</label>
              <input id="password" name="password" type="password" className="input" required minLength={reg ? 10 : 1} maxLength={200} autoComplete={reg ? "new-password" : "current-password"} />
              {reg && <p className="hint">Mínimo de 10 caracteres, não só números.</p>}
            </div>
            {err && <p role="alert" className="text-sm text-[#b4401f] bg-coral-soft rounded-xl px-3 py-2">{err}</p>}
            <button className="btn btn-primary w-full" disabled={busy}>{busy ? "Aguarde…" : reg ? "Criar conta" : "Entrar"}</button>
          </form>
        </div>
        <p className="text-center text-sm text-muted mt-5">
          {reg ? <>Já tem conta? <Link href="/entrar" className="text-teal-deep font-semibold">Entrar</Link></> : <>Recebeu um convite? <Link href="/cadastro" className="text-teal-deep font-semibold">Criar conta</Link></>}
        </p>
      </div>
    </main>
  );
}
