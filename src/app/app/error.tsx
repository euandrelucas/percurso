"use client";
import { useEffect } from "react";

/** Se algo quebrar numa tela do paciente, mostra uma mensagem calma (com o telefone de ajuda) em vez do erro genérico do navegador. */
export default function PatientError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[app] erro na tela:", error.message, error.digest ?? "");
  }, [error]);
  return (
    <div className="card max-w-lg mx-auto text-center py-10">
      <h1 className="text-2xl font-semibold">Algo não saiu como esperado</h1>
      <p className="text-ink-soft mt-3 leading-relaxed">Tivemos um problema para mostrar esta tela. Suas conversas continuam salvas. Tente de novo e, se persistir, recarregue a página.</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button className="btn btn-primary" onClick={reset}>Tentar de novo</button>
        <a className="btn btn-ghost" href="/app">Voltar ao início</a>
      </div>
      <p className="text-xs text-muted mt-6">Se precisar de apoio agora: 188 (CVV, 24h) · 192 (SAMU){error.digest ? ` · código ${error.digest}` : ""}</p>
    </div>
  );
}
