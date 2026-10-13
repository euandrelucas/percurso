"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const FACES = [
  { e: "😞", s: 1, t: "Muito mal" },
  { e: "😕", s: 3, t: "Mal" },
  { e: "😐", s: 5, t: "Mais ou menos" },
  { e: "🙂", s: 7, t: "Bem" },
  { e: "😄", s: 9, t: "Muito bem" },
];

/** Humor em um toque (carinhas). "Escolher de 0 a 10" abre a escala completa para quem quer precisão. */
export function MoodCheckin({ today }: { today?: number | null }) {
  const router = useRouter();
  const [score, setScore] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  const [fine, setFine] = useState(false);
  async function save(n: number) {
    setScore(n);
    await fetch("/api/mood", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ score: n }) });
    setSaved(true);
    router.refresh();
  }
  return (
    <div>
      <p className="font-semibold">{today != null && !saved ? "Quer atualizar como você está?" : "Como você está agora?"}</p>
      <p className="text-xs text-muted mb-3">{today != null && !saved ? `Hoje você registrou ${today}/10. Um toque para registrar de novo.` : "Um toque já ajuda você a enxergar sua evolução."}</p>
      <div className="grid grid-cols-5 gap-2" role="group" aria-label="Como você está">
        {FACES.map((f) => (
          <button key={f.s} onClick={() => save(f.s)} aria-pressed={score === f.s} aria-label={`${f.t} (${f.s} de 10)`} className="rounded-2xl border border-line bg-paper py-2.5 text-center hover:border-teal aria-pressed:border-teal aria-pressed:bg-teal-soft">
            <div className="text-2xl">{f.e}</div>
            <div className="text-[11px] text-muted mt-0.5 leading-tight">{f.t}</div>
          </button>
        ))}
      </div>
      <button className="text-xs text-muted underline mt-2" onClick={() => setFine(!fine)}>{fine ? "esconder escala" : "prefiro escolher de 0 a 10"}</button>
      {fine && (
        <div className="flex flex-wrap gap-1.5 mt-2" role="group" aria-label="Nota de humor de 0 a 10">
          {Array.from({ length: 11 }, (_, i) => (
            <button key={i} onClick={() => save(i)} aria-pressed={score === i} className="w-9 h-9 rounded-full text-sm font-semibold border border-line bg-paper hover:border-teal aria-pressed:bg-teal aria-pressed:text-white aria-pressed:border-teal">{i}</button>
          ))}
        </div>
      )}
      {saved && <p className="text-xs text-teal-deep mt-2">Registrado. Obrigado por cuidar de você 💛</p>}
    </div>
  );
}

export function ExerciseItem({ ex }: { ex: { id: number; title: string; description: string; status: string; feedback: string | null } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fb, setFb] = useState("");
  const [skipped, setSkipped] = useState(false);
  async function mark(status: "feito" | "pendente" | "nao_realizado") {
    await fetch(`/api/exercises/${ex.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, feedback: fb }) });
    setOpen(false);
    if (status === "nao_realizado") return setSkipped(true); // fica na tela com uma mensagem gentil
    router.refresh();
  }
  const done = ex.status === "feito";
  return (
    <li className="rounded-2xl border border-line bg-paper p-4">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 w-5 h-5 rounded-full border-2 grid place-items-center text-[11px] text-white ${done ? "bg-teal border-teal" : "border-line"}`} aria-hidden>{done ? "✓" : ""}</div>
        <div className="flex-1 min-w-0">
          <p className={`font-semibold ${done ? "line-through text-muted" : ""}`}>{ex.title}</p>
          <p className="text-sm text-ink-soft mt-0.5">{ex.description}</p>
          {ex.feedback && <p className="text-xs text-muted mt-1.5">Você disse: “{ex.feedback}”</p>}
          {skipped && <p className="text-sm text-teal-deep mt-2">Tudo bem, acontece. Na próxima conversa a gente ajusta o exercício para ficar mais fácil 💛</p>}
          {ex.status === "pendente" && !open && !skipped && <button className="text-sm text-teal-deep font-semibold mt-2" onClick={() => setOpen(true)}>Responder: fiz / não consegui</button>}
          {ex.status === "pendente" && open && !skipped && (
            <div className="mt-3 space-y-2">
              <textarea className="input text-sm" rows={2} maxLength={400} placeholder="Como foi? Se não deu, o que atrapalhou? (opcional — seu acompanhante vai ler isso)" value={fb} onChange={(e) => setFb(e.target.value)} />
              <div className="flex flex-wrap gap-2"><button className="btn btn-primary !py-1.5 !px-4 text-sm" onClick={() => mark("feito")}>Fiz ✓</button><button className="btn btn-ghost !py-1.5 !px-4 text-sm" onClick={() => mark("nao_realizado")}>Não consegui</button><button className="text-xs text-muted underline px-2" onClick={() => setOpen(false)}>Cancelar</button></div>
            </div>
          )}
          {done && <button className="text-xs text-muted underline mt-1.5" onClick={() => mark("pendente")}>desfazer</button>}
        </div>
      </div>
    </li>
  );
}

const b64 = (k: string) => Uint8Array.from(atob(k.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(k.length / 4) * 4, "=")), (c) => c.charCodeAt(0));

/** Lembrete gentil diário (19h) por notificação do navegador/app instalado. Só aparece onde o aparelho suporta. */
export function ReminderToggle() {
  const [state, setState] = useState<"unsupported" | "off" | "on" | "denied" | "busy">("unsupported");
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return;
    if (Notification.permission === "denied") return setState("denied");
    navigator.serviceWorker.getRegistration().then((r) => r?.pushManager.getSubscription()).then((sub) => setState(sub ? "on" : "off")).catch(() => setState("off"));
  }, []);
  async function enable() {
    setState("busy");
    try {
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.ready);
      if ((await Notification.requestPermission()) !== "granted") return setState("denied");
      const { key } = (await (await fetch("/api/push/key")).json()) as { key: string };
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
      const r = await fetch("/api/push/subscribe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(sub.toJSON()) });
      setState(r.ok ? "on" : "off");
    } catch {
      setState("off");
    }
  }
  async function disable() {
    setState("busy");
    try {
      const sub = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
    } finally {
      setState("off");
    }
  }
  if (state === "unsupported") return null;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span aria-hidden>🔔</span>
      <div className="flex-1">
        <p className="font-semibold">Lembrete gentil às 19h</p>
        <p className="text-xs text-muted">{state === "denied" ? "As notificações estão bloqueadas neste navegador. Libere nas configurações do site para ativar." : "Um aviso curto, sem detalhes, só se você ainda não tiver conversado hoje."}</p>
      </div>
      {state === "off" && <button className="btn btn-ghost !py-1.5 !px-4 text-sm" onClick={enable}>Ativar</button>}
      {state === "on" && <button className="btn btn-ghost !py-1.5 !px-4 text-sm" onClick={disable}>Desativar</button>}
      {state === "busy" && <span className="text-xs text-muted">…</span>}
    </div>
  );
}
