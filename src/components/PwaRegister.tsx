"use client";
import { useEffect, useState } from "react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Registra o service worker (só em produção) e oferece "Instalar app" quando o navegador permite. */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }
  }, []);
  return null;
}

export function InstallPrompt() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [hidden, setHidden] = useState(true);

  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem("percurso-install-dismissed") === "1";
    } catch {
      /* sem storage */
    }
    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone;
    if (dismissed || standalone) return;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
    setIos(isIos);
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
      setHidden(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    if (isIos) setHidden(false);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (hidden || (!evt && !ios)) return null;
  const close = () => {
    setHidden(true);
    try {
      localStorage.setItem("percurso-install-dismissed", "1");
    } catch {
      /* ignora */
    }
  };
  return (
    <div role="region" aria-label="Instalar aplicativo" className="card !p-4 flex items-center gap-3 mb-6 bg-teal-soft !border-teal/30">
      <div className="flex-1 text-sm">
        <strong className="block">Instale o Percurso no seu celular</strong>
        {ios ? <span className="text-ink-soft">No Safari, toque em <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>.</span> : <span className="text-ink-soft">Abre em tela cheia, como um app, direto da tela inicial.</span>}
      </div>
      {evt && <button className="btn btn-primary !py-2 !px-4 text-sm" onClick={async () => { await evt.prompt(); await evt.userChoice.catch(() => {}); close(); }}>Instalar</button>}
      <button className="text-xs text-muted underline" onClick={close}>agora não</button>
    </div>
  );
}
