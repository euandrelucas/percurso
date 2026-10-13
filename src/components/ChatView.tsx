"use client";
import { useEffect, useRef, useState } from "react";
import { AvatarThumb } from "./Avatar";
import type { Avatar as AvatarT } from "@/lib/prompts/options";

type Msg = { id: string; role: "user" | "assistant" | "crisis"; text: string; at: string };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const hhmm = (d: Date) => d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export function ChatView({ agentName, avatar, initial }: { agentName: string; avatar: AvatarT; initial: { id: number; role: string; content: string; at: string }[] }) {
  const [msgs, setMsgs] = useState<Msg[]>(() =>
    initial.flatMap((m): Msg[] =>
      m.role === "assistant"
        ? m.content.split(/\n{2,}/).map((t, i) => ({ id: `${m.id}-${i}`, role: "assistant" as const, text: t, at: hhmm(new Date(m.at)) }))
        : [{ id: String(m.id), role: "user" as const, text: m.content, at: hhmm(new Date(m.at)) }],
    ),
  );
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" }), [msgs, typing]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t || busy) return;
    setText("");
    setBusy(true);
    const now = () => hhmm(new Date());
    setMsgs((m) => [...m, { id: `u${Date.now()}`, role: "user", text: t, at: now() }]);
    setTyping(true);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: t }) });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTyping(false);
        setMsgs((m) => [...m, { id: `e${Date.now()}`, role: "assistant", text: j.error ?? "Não consegui responder agora.", at: now() }]);
        return;
      }
      // Balões chegam em sequência, com "digitando…" proporcional ao tamanho: soa como uma pessoa escrevendo.
      const bubbles: string[] = j.bubbles;
      for (let i = 0; i < bubbles.length; i++) {
        if (i > 0) setTyping(true);
        await sleep(Math.min(2200, 500 + bubbles[i].length * 18));
        setTyping(false);
        setMsgs((m) => [...m, { id: `a${Date.now()}-${i}`, role: "assistant", text: bubbles[i], at: now() }]);
        if (i < bubbles.length - 1) await sleep(250);
      }
      if (j.crisis) setMsgs((m) => [...m, { id: `c${Date.now()}`, role: "crisis", text: j.crisis.text, at: now() }]);
    } catch {
      setTyping(false);
      setMsgs((m) => [...m, { id: `e${Date.now()}`, role: "assistant", text: "Perdi a conexão por um instante. Se for urgente, ligue 188 (CVV).", at: now() }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card !p-0 overflow-hidden flex flex-col h-[calc(100dvh-14rem)] min-h-[460px] max-w-2xl mx-auto">
      <div className="flex items-center gap-3 px-4 py-3 bg-night text-white">
        <AvatarThumb avatar={avatar} size={96} className="w-10 h-10 rounded-full" />
        <div><div className="font-semibold leading-tight">{agentName}</div><div className="text-xs text-white/60">IA de apoio · responde na hora</div></div>
      </div>
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-1.5 bg-[#efeae0]" aria-live="polite">
        <div className="text-center text-[12px] text-muted bg-white/70 rounded-xl px-3 py-2 mx-auto max-w-sm mb-3">Canal para momentos de emergência. Em perigo imediato, ligue <strong>188</strong> (CVV) ou <strong>192</strong> (SAMU).</div>
        {msgs.map((m) =>
          m.role === "crisis" ? (
            <div key={m.id} className="fade-up my-3 rounded-2xl bg-coral-soft border border-[#f6d2c9] p-4 text-sm text-ink-soft whitespace-pre-line">{m.text}</div>
          ) : (
            <div key={m.id} className={`fade-up flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-[15px] shadow-sm ${m.role === "user" ? "bg-[#d6f1ec] rounded-br-md" : "bg-paper rounded-bl-md"}`}>
                <span className="whitespace-pre-wrap break-words">{m.text}</span>
                <span className="block text-right text-[10px] text-muted mt-0.5">{m.at}{m.role === "user" && <span className="text-teal ml-1">✓✓</span>}</span>
              </div>
            </div>
          ),
        )}
        {typing && <div className="flex"><div className="bg-paper rounded-2xl rounded-bl-md px-4 py-3 shadow-sm typing" aria-label="digitando"><span /><span /><span /></div></div>}
        <div ref={bottom} />
      </div>
      <form onSubmit={send} className="flex items-end gap-2 p-3 border-t border-line bg-paper">
        <textarea
          className="input !rounded-3xl resize-none max-h-32"
          rows={1}
          value={text}
          maxLength={2000}
          placeholder="Escreva uma mensagem"
          aria-label="Mensagem"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(e); } }}
        />
        <button className="btn btn-primary !px-5" disabled={!text.trim() || busy} aria-label="Enviar">Enviar</button>
      </form>
    </div>
  );
}
