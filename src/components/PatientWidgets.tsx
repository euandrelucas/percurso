"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export function MoodCheckin() {
  const router = useRouter();
  const [score, setScore] = useState<number | null>(null);
  const [saved, setSaved] = useState(false);
  async function save(n: number) {
    setScore(n);
    await fetch("/api/mood", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ score: n }) });
    setSaved(true);
    router.refresh();
  }
  return (
    <div>
      <p className="font-semibold">Como você está agora?</p>
      <p className="text-xs text-muted mb-3">0 = muito mal · 10 = muito bem</p>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Nota de humor">
        {Array.from({ length: 11 }, (_, i) => (
          <button key={i} onClick={() => save(i)} aria-pressed={score === i} className="w-9 h-9 rounded-full text-sm font-semibold border border-line bg-white hover:border-teal aria-pressed:bg-teal aria-pressed:text-white aria-pressed:border-teal">{i}</button>
        ))}
      </div>
      {saved && <p className="text-xs text-teal-deep mt-2">Registrado. Obrigado por cuidar de você 💛</p>}
    </div>
  );
}

export function ExerciseItem({ ex }: { ex: { id: number; title: string; description: string; status: string; feedback: string | null } }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fb, setFb] = useState("");
  async function mark(status: "feito" | "pendente") {
    await fetch(`/api/exercises/${ex.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, feedback: fb }) });
    setOpen(false);
    router.refresh();
  }
  const done = ex.status === "feito";
  return (
    <li className="rounded-2xl border border-line bg-white p-4">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 w-5 h-5 rounded-full border-2 grid place-items-center text-[11px] text-white ${done ? "bg-teal border-teal" : "border-line"}`} aria-hidden>{done ? "✓" : ""}</div>
        <div className="flex-1 min-w-0">
          <p className={`font-semibold ${done ? "line-through text-muted" : ""}`}>{ex.title}</p>
          <p className="text-sm text-ink-soft mt-0.5">{ex.description}</p>
          {ex.feedback && <p className="text-xs text-muted mt-1.5">Você disse: “{ex.feedback}”</p>}
          {ex.status === "pendente" && !open && <button className="text-sm text-teal-deep font-semibold mt-2" onClick={() => setOpen(true)}>Marcar como feito</button>}
          {ex.status === "pendente" && open && (
            <div className="mt-3 space-y-2">
              <textarea className="input text-sm" rows={2} maxLength={400} placeholder="Como foi? (opcional — seu acompanhante vai ler isso)" value={fb} onChange={(e) => setFb(e.target.value)} />
              <div className="flex gap-2"><button className="btn btn-primary !py-1.5 !px-4 text-sm" onClick={() => mark("feito")}>Salvar</button><button className="btn btn-ghost !py-1.5 !px-4 text-sm" onClick={() => setOpen(false)}>Cancelar</button></div>
            </div>
          )}
          {done && <button className="text-xs text-muted underline mt-1.5" onClick={() => mark("pendente")}>desfazer</button>}
        </div>
      </div>
    </li>
  );
}
