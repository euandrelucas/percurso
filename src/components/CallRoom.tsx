"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import type { Avatar as AvatarT } from "@/lib/prompts/options";
import { helpSignalCue, REMINDER_VOICE, TRANSCRIPT_WRONG_CUE, timeCue } from "@/lib/prompts/phases";
import { Icon } from "@/components/icons";

type Props = { agent: { name: string; avatar: AvatarT; preferredName: string }; first: boolean; maxMinutes: number; resumable: boolean };
type Phase = "lobby" | "connecting" | "live" | "ended" | "error";

const SAD = /\b(triste|tristeza|mal|chor(o|ar|ei|ando)|medo|ansios[oa]|ansiedade|sozinh[oa]|cansad[oa]|culpa|angusti|sofr(o|er|endo|imento)|perd(i|er|eu)|saudade|n[ãa]o consigo|desanim|vazi[oa]|deprimid|p[âa]nico|magoad|traí|trai[çc])/i;
const HAPPY = /\b(feliz|[óo]timo|consegui|orgulh|alegr|melhor|passei|aprovad|animad|tranquil[oa]|aliviad|gostei|legal|maravilh)/i;
const moodOf = (t: string): "neutral" | "warm" | "concerned" => (SAD.test(t) ? "concerned" : HAPPY.test(t) ? "warm" : "neutral");
const mmss = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;
const post = (url: string, body?: unknown) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });

export function CallRoom({ agent, first, maxMinutes, resumable }: Props) {
  const [phase, setPhase] = useState<Phase>("lobby");
  const [err, setErr] = useState("");
  const [muted, setMuted] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [captions, setCaptions] = useState(true);
  const [caption, setCaption] = useState<{ who: "ai" | "me"; text: string } | null>(null);
  const [secs, setSecs] = useState(maxMinutes * 60);
  const [thinking, setThinking] = useState(false);
  const [demo, setDemo] = useState(false);
  const [typed, setTyped] = useState("");
  const [crisis, setCrisis] = useState(false);
  const [micLevel, setMicLevel] = useState(0);

  const pc = useRef<RTCPeerConnection | null>(null);
  const dc = useRef<RTCDataChannel | null>(null);
  const mic = useRef<MediaStream | null>(null);
  const cam = useRef<MediaStream | null>(null);
  const selfVideo = useRef<HTMLVideoElement>(null);
  // Elemento de áudio fora da árvore do React: a faixa remota chega ANTES da tela "live" existir (o <audio> da tela não estaria montado).
  const audioEl = useRef<HTMLAudioElement | null>(null);
  const [needsSound, setNeedsSound] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [toast, setToast] = useState("");
  const [micState, setMicState] = useState<"idle" | "listening" | "ok" | "silent">("idle");
  const [faceMood, setFaceMood] = useState<"neutral" | "warm" | "concerned">("neutral");
  const [fixable, setFixable] = useState(false); // legenda da última fala pode ser marcada como errada
  const reconnectingRef = useRef(false);
  const helpPresses = useRef(0);
  const brainMode = useRef(false); // "dois cérebros": o servidor escreve cada fala e a voz só lê
  const brainSpeaking = useRef(false);
  const turnSeq = useRef(0);
  const goodbyeRef = useRef<() => void>(() => {});
  const moodTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [fb, setFb] = useState<{ rating: number | null; note: string; sent: boolean; busy: boolean }>({ rating: null, note: "", sent: false, busy: false });
  const actx = useRef<AudioContext | null>(null);
  const analyser = useRef<AnalyserNode | null>(null);
  const levelBuf = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const demoLevel = useRef(0);
  const sid = useRef<number | null>(null);
  const endAt = useRef(0);
  const sent = useRef<Set<string>>(new Set());
  const ending = useRef(false);
  const lastSound = useRef(Date.now());
  const userSpeaking = useRef(false);
  const aiDraft = useRef("");
  const phaseRef = useRef<Phase>("lobby");
  const kindRef = useRef<"triagem" | "acompanhamento">(first ? "triagem" : "acompanhamento");
  phaseRef.current = phase;

  const getLevel = useCallback(() => {
    if (demoLevel.current > 0) return demoLevel.current;
    const a = analyser.current;
    const buf = levelBuf.current;
    if (!a || !buf) return 0;
    a.getByteTimeDomainData(buf);
    let sum = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / buf.length);
    const l = Math.min(1, rms * 5);
    if (l > 0.04) lastSound.current = Date.now();
    return l;
  }, []);

  // --- Lobby: câmera/microfone locais (nada de vídeo é enviado a lugar nenhum) ---------------------------------
  const startMicPreview = useCallback(async () => {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      mic.current = s;
      const ctx = new AudioContext();
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      ctx.createMediaStreamSource(s).connect(an);
      const buf = new Uint8Array(an.fftSize);
      setMicState("listening");
      let loud = 0;
      const t0 = Date.now();
      const loop = () => {
        if (phaseRef.current !== "lobby") return;
        an.getByteTimeDomainData(buf);
        let sum = 0;
        for (const b of buf) sum += ((b - 128) / 128) ** 2;
        const lvl = Math.min(1, Math.sqrt(sum / buf.length) * 6);
        setMicLevel(lvl);
        loud = lvl > 0.12 ? loud + 1 : Math.max(0, loud - 1);
        if (loud > 8) setMicState("ok");
        else if (Date.now() - t0 > 6000) setMicState((m) => (m === "ok" ? m : "silent"));
        requestAnimationFrame(loop);
      };
      loop();
      setTimeout(() => void ctx.close().catch(() => {}), 120000);
    } catch {
      setErr("Não consegui acessar o microfone. Libere a permissão no navegador (ícone de cadeado) e recarregue a página.");
    }
  }, []);

  const toggleCam = useCallback(async () => {
    if (camOn) {
      cam.current?.getTracks().forEach((t) => t.stop());
      cam.current = null;
      setCamOn(false);
      return;
    }
    try {
      cam.current = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480, facingMode: "user" } });
      setCamOn(true);
    } catch {
      setErr("Não consegui acessar a câmera. Você pode participar só com áudio.");
    }
  }, [camOn]);

  useEffect(() => {
    if (camOn && selfVideo.current && cam.current) selfVideo.current.srcObject = cam.current;
  }, [camOn, phase]);

  useEffect(() => () => cleanup(), []); // eslint-disable-line react-hooks/exhaustive-deps

  function cleanup() {
    pc.current?.close();
    pc.current = null;
    dc.current = null;
    mic.current?.getTracks().forEach((t) => t.stop());
    cam.current?.getTracks().forEach((t) => t.stop());
    if (audioEl.current) {
      audioEl.current.pause();
      audioEl.current.srcObject = null;
    }
    void actx.current?.close().catch(() => {});
    actx.current = null;
    analyser.current = null;
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
  }

  // --- Eventos do canal de dados da API Realtime --------------------------------------------------------------
  const sendEvent = useCallback((e: unknown) => {
    if (dc.current?.readyState === "open") dc.current.send(JSON.stringify(e));
  }, []);

  const injectSystem = useCallback(
    (text: string, respond: boolean) => {
      sendEvent({ type: "conversation.item.create", item: { type: "message", role: "system", content: [{ type: "input_text", text }] } });
      if (respond) sendEvent({ type: "response.create" });
    },
    [sendEvent],
  );

  const flash = useCallback((t: string) => {
    setToast(t);
    setTimeout(() => setToast(""), 4500);
  }, []);
  /** Pede ao servidor a próxima fala (modelo de texto forte) e manda a voz lê-la. Se falhar, a própria voz responde (plano B). */
  const askBrain = useCallback(
    async (input: { kind: "turn" | "open" | "time" | "signal"; text?: string; minutes?: number; signal?: "nao_ajudando" | "transcricao_errada"; presses?: number }) => {
      if (!sid.current) return;
      const mine = ++turnSeq.current;
      setThinking(true);
      try {
        const ctrl = new AbortController();
        const to = setTimeout(() => ctrl.abort(), 10000);
        const r = await fetch(`/api/call/${sid.current}/brain`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input), signal: ctrl.signal });
        clearTimeout(to);
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as { reply: string; end: boolean; crisis: boolean };
        if (j.crisis) setCrisis(true);
        if (mine !== turnSeq.current || userSpeaking.current) return; // a pessoa já falou de novo: descarta a resposta velha
        brainSpeaking.current = true;
        sendEvent({
          type: "response.create",
          response: {
            output_modalities: ["audio"],
            instructions: `Leia em voz alta, em português do Brasil, EXATAMENTE o texto abaixo, sem acrescentar nem tirar nada, com entonação natural de conversa (calorosa e próxima, não de locutor).\n\nTEXTO:\n${j.reply}`,
          },
        });
        if (j.end) goodbyeRef.current();
      } catch {
        if (mine !== turnSeq.current || ending.current) return;
        brainSpeaking.current = false;
        sendEvent({ type: "response.create" }); // plano B: a voz responde sozinha
      }
    },
    [sendEvent],
  );

  const notHelping = useCallback(() => {
    if (!sid.current || ending.current) return;
    void post(`/api/call/${sid.current}/signal`, { kind: "nao_ajudando" });
    helpPresses.current += 1;
    if (brainMode.current) void askBrain({ kind: "signal", signal: "nao_ajudando", presses: helpPresses.current });
    else injectSystem(helpSignalCue(helpPresses.current), true);
    setThinking(true);
    flash("Entendi. Vou pedir para tentar de outro jeito.");
  }, [injectSystem, flash, askBrain]);
  const wrongCaption = useCallback(() => {
    if (!sid.current || ending.current) return;
    void post(`/api/call/${sid.current}/signal`, { kind: "transcricao_errada" });
    sendEvent({ type: "response.cancel" });
    if (brainMode.current) void askBrain({ kind: "signal", signal: "transcricao_errada" });
    else injectSystem(TRANSCRIPT_WRONG_CUE, true);
    setFixable(false);
    setCaption(null);
    flash("Ok, vou pedir para repetir.");
  }, [injectSystem, sendEvent, flash, askBrain]);

  const injected = useRef<Set<string>>(new Set());
  const saveTurn = useCallback(async (role: "user" | "assistant", text: string) => {
    if (!sid.current || !text.trim()) return;
    try {
      const r = await post(`/api/call/${sid.current}/turn`, { role, text, injected: [...injected.current] });
      const j = await r.json();
      if (j.risk >= 2) setCrisis(true);
      if (j.longCue) sendEvent({ type: "conversation.item.create", item: { type: "message", role: "system", content: [{ type: "input_text", text: j.longCue }] } });
      if (j.riskCue) sendEvent({ type: "conversation.item.create", item: { type: "message", role: "system", content: [{ type: "input_text", text: j.riskCue }] } });
      // conhecimento clínico "na hora certa" para o assunto que acabou de surgir (sem forçar resposta)
      if (j.knowledge?.text) {
        for (const id of j.knowledge.ids as string[]) injected.current.add(id);
        sendEvent({ type: "conversation.item.create", item: { type: "message", role: "system", content: [{ type: "input_text", text: j.knowledge.text }] } });
      }
    } catch {
      /* a transcrição é reenviada na próxima fala; a sessão não cai por isso */
    }
  }, [sendEvent]);

  const finish = useCallback(
    async (reason: "agente" | "paciente" | "tempo" | "falha_tecnica") => {
      if (ending.current) return;
      ending.current = true;
      cleanup();
      setPhase("ended");
      if (sid.current) await post(`/api/call/${sid.current}/end`, { reason }).catch(() => {});
    },
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const finishAfterGoodbye = useCallback(() => {
    // Espera a despedida terminar de ser falada (silêncio por 1,8s) antes de desligar — nunca corta a fala no meio.
    const started = Date.now();
    const iv = setInterval(() => {
      getLevel();
      if (Date.now() - lastSound.current > 1800 || Date.now() - started > 20000) {
        clearInterval(iv);
        void finish("agente");
      }
    }, 400);
  }, [finish, getLevel]);

  const onEvent = useCallback(
    (raw: string) => {
      let e: { type: string; [k: string]: unknown };
      try {
        e = JSON.parse(raw);
      } catch {
        return;
      }
      switch (e.type) {
        case "input_audio_buffer.speech_started":
          userSpeaking.current = true;
          setThinking(false);
          break;
        case "input_audio_buffer.speech_stopped":
          userSpeaking.current = false;
          setThinking(true);
          break;
        case "conversation.item.input_audio_transcription.completed": {
          const t = String(e.transcript ?? "").trim();
          // Descarta transcrições típicas de alucinação em ruído/silêncio (só pontuação, créditos de legenda etc.).
          if (t && !/^[\s.,!?…\-–]*$/.test(t) && !/amara\.org|legendas? (pela|por|de)|inscreva-se|obrigad[oa] por assistir|www\./i.test(t)) {
            setCaption({ who: "me", text: t });
            setFixable(true);
            // O rosto reage ao que a pessoa acabou de dizer (por ~25 s): preocupado em assunto pesado, sorriso em boa notícia.
            const m = moodOf(t);
            if (m !== "neutral") {
              setFaceMood(m);
              if (moodTimer.current) clearTimeout(moodTimer.current);
              moodTimer.current = setTimeout(() => setFaceMood("neutral"), 25000);
            }
            void saveTurn("user", t);
          }
          break;
        }
        case "response.output_audio_transcript.delta":
        case "response.audio_transcript.delta":
          setFixable(false);
          setThinking(false);
          aiDraft.current += String(e.delta ?? "");
          setCaption({ who: "ai", text: aiDraft.current });
          break;
        case "response.output_audio_transcript.done":
        case "response.audio_transcript.done": {
          const t = String(e.transcript ?? aiDraft.current).trim();
          aiDraft.current = "";
          if (t) {
            setCaption({ who: "ai", text: t });
            if (brainSpeaking.current) brainSpeaking.current = false; // já salva pelo servidor
            else void saveTurn("assistant", t);
          }
          break;
        }
        case "response.done": {
          const out = ((e.response as { output?: { type: string; name?: string; arguments?: string; call_id?: string }[] })?.output ?? []);
          const spoke = out.some((o) => o.type === "message");
          const resp = e.response as { status?: string; status_details?: { error?: { message?: string } } } | undefined;
          if (resp?.status === "failed") {
            console.warn("[realtime] resposta falhou", resp.status_details);
            setErr(`A IA não conseguiu responder${resp.status_details?.error?.message ? `: ${resp.status_details.error.message}` : "."}`);
            setThinking(false);
          }
          for (const o of out) {
            if (o.type !== "function_call" || !o.call_id) continue;
            let args: Record<string, unknown> = {};
            try {
              args = JSON.parse(o.arguments ?? "{}");
            } catch {
              /* args inválidos: segue sem eles */
            }
            sendEvent({ type: "conversation.item.create", item: { type: "function_call_output", call_id: o.call_id, output: JSON.stringify({ ok: true }) } });
            if (o.name === "sinalizar_risco" && sid.current) {
              void post(`/api/call/${sid.current}/risk`, args);
              if (Number(args.nivel) >= 2) setCrisis(true);
              if (!spoke) sendEvent({ type: "response.create" });
            } else if (o.name === "finalizar_sessao") {
              finishAfterGoodbye();
            }
          }
          break;
        }
        case "error": {
          console.warn("[realtime]", e);
          const m = (e.error as { message?: string } | undefined)?.message;
          setErr(`A IA não conseguiu responder${m ? `: ${m}` : "."} Se persistir, saia e entre de novo.`);
          setThinking(false);
          break;
        }
      }
    },
    [finishAfterGoodbye, saveTurn, sendEvent, askBrain],
  );
  goodbyeRef.current = finishAfterGoodbye;

  // --- Conexão em tempo real (também usada para reconectar sem perder a sessão) ---------------------------------
  async function openRealtime(sessionId: number) {
    mic.current ??= await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    const conn = new RTCPeerConnection();
    pc.current = conn;
    conn.ontrack = (ev) => {
      const stream = ev.streams[0];
      audioEl.current ??= new Audio();
      audioEl.current.autoplay = true;
      audioEl.current.srcObject = stream;
      audioEl.current.muted = false;
      audioEl.current.volume = 1;
      // Alguns navegadores (iOS/Safari, Chrome com política restrita) bloqueiam o autoplay: pede um toque para liberar o som.
      audioEl.current.play().catch(() => setNeedsSound(true));
      void actx.current?.close().catch(() => {});
      const ctx = new AudioContext();
      void ctx.resume().catch(() => {});
      actx.current = ctx;
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      ctx.createMediaStreamSource(stream).connect(an); // só mede; o som sai pelo <audio>
      analyser.current = an;
      levelBuf.current = new Uint8Array(an.fftSize);
    };
    conn.onconnectionstatechange = () => {
      if (pc.current !== conn || ending.current) return;
      if (conn.connectionState === "failed") void reconnect();
      else if (conn.connectionState === "disconnected") setTimeout(() => pc.current === conn && conn.connectionState === "disconnected" && void reconnect(), 4000);
    };
    mic.current.getAudioTracks().forEach((t) => conn.addTrack(t, mic.current!));
    const ch = conn.createDataChannel("oai-events");
    dc.current = ch;
    ch.onmessage = (m) => onEvent(String(m.data));
    ch.onclose = () => {
      if (pc.current === conn && !ending.current) void reconnect();
    };
    ch.onopen = () => {
      setReconnecting(false);
      setPhase("live");
      setThinking(true);
      // O agente fala primeiro (ou retoma: "pronto, voltei"). Em modo cérebro a fala vem do servidor.
      if (brainMode.current) void askBrain({ kind: "open" });
      else sendEvent({ type: "response.create" });
    };
    const offer = await conn.createOffer();
    await conn.setLocalDescription(offer);
    const res = await fetch(`/api/call/${sessionId}/connect`, { method: "POST", headers: { "Content-Type": "application/sdp" }, body: offer.sdp });
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Falha ao conectar.");
    await conn.setRemoteDescription({ type: "answer", sdp: await res.text() });
  }

  /** Queda de conexão no meio da conversa: tenta voltar sozinho (até 4 vezes) e a IA retoma de onde parou. */
  async function reconnect() {
    if (reconnectingRef.current || ending.current || !sid.current) return;
    reconnectingRef.current = true;
    setReconnecting(true);
    void post(`/api/call/${sid.current}/signal`, { kind: "reconexao" });
    for (let i = 1; i <= 4 && !ending.current; i++) {
      try {
        const old = pc.current;
        pc.current = null;
        dc.current = null;
        old?.close();
        await new Promise((r) => setTimeout(r, 700 * i));
        if (ending.current) break;
        await openRealtime(sid.current);
        const isOpen = () => dc.current?.readyState === "open";
        for (let w = 0; w < 40 && !isOpen(); w++) await new Promise((r) => setTimeout(r, 200));
        if (isOpen()) {
          reconnectingRef.current = false;
          setReconnecting(false);
          return;
        }
      } catch {
        /* tenta de novo */
      }
    }
    reconnectingRef.current = false;
    setReconnecting(false);
    if (!ending.current) {
      setErr("A conexão não voltou. Você pode entrar de novo: a conversa continua de onde parou.");
      void finish("falha_tecnica");
    }
  }

  // --- Entrar na chamada --------------------------------------------------------------------------------------
  async function join() {
    setErr("");
    setPhase("connecting");
    try {
      const r = await post("/api/call/start");
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Não foi possível iniciar.");
      sid.current = j.sessionId;
      kindRef.current = j.kind;
      brainMode.current = !!j.brain;
      endAt.current = Date.now() + j.secondsLeft * 1000;
      setSecs(j.secondsLeft);

      if (j.mock) {
        setDemo(true);
        setPhase("live");
        speakDemo(`Oi, ${agent.preferredName}. Que bom te ver. Como você está chegando hoje?`);
        return;
      }
      await openRealtime(j.sessionId);
    } catch (e) {
      cleanup();
      setErr(e instanceof Error ? e.message : "Erro inesperado.");
      setPhase("error");
    }
  }

  // --- Cronômetro e avisos de tempo (a IA não enxerga o relógio; avisamos nós) ---------------------------------
  useEffect(() => {
    if (phase !== "live") return;
    const iv = setInterval(() => {
      const left = Math.round((endAt.current - Date.now()) / 1000);
      setSecs(left);
      if (demo || ending.current) return;
      const idle = Date.now() - lastSound.current > 4000 && !userSpeaking.current;
      const cue = (key: string, mins: number, respond: boolean) => {
        if (!sent.current.has(key)) {
          sent.current.add(key);
          // Em modo cérebro o servidor já sabe quanto tempo resta a cada fala; só pede o fechamento proativo se a pessoa estiver calada.
          if (brainMode.current) {
            if (respond && idle) void askBrain({ kind: "time", minutes: mins });
          } else injectSystem(timeCue(mins, kindRef.current), respond && idle);
        }
      };
      if (left <= 600 && left > 300) cue("10", 10, false);
      if (left <= 300 && left > 60) cue("5", 5, true);
      if (left <= 60 && left > 20) cue("1", 1, true);
      if (left <= -20) void finish("tempo"); // tolerância para a despedida terminar
    }, 1000);
    return () => clearInterval(iv);
  }, [phase, demo, injectSystem, finish, askBrain]);

  // Lembrete de persona a cada ~10 min (reduz deriva de personalidade em conversas longas).
  useEffect(() => {
    if (phase !== "live" || demo) return;
    const iv = setInterval(() => {
      injectSystem(REMINDER_VOICE, false);
    }, 10 * 60 * 1000);
    return () => clearInterval(iv);
  }, [phase, demo, injectSystem]);

  const toggleMute = () => {
    const next = !muted;
    mic.current?.getAudioTracks().forEach((t) => (t.enabled = !next));
    setMuted(next);
  };

  // --- Modo demonstração (sem chave da OpenAI): voz do navegador + texto digitado ------------------------------
  function speakDemo(text: string) {
    setCaption({ who: "ai", text });
    if (typeof speechSynthesis === "undefined") return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "pt-BR";
    let iv: ReturnType<typeof setInterval>;
    u.onstart = () => (iv = setInterval(() => (demoLevel.current = 0.15 + Math.random() * 0.6), 90));
    u.onend = u.onerror = () => {
      clearInterval(iv);
      demoLevel.current = 0;
    };
    speechSynthesis.speak(u);
  }
  async function sendTyped(e: React.FormEvent) {
    e.preventDefault();
    const t = typed.trim();
    if (!t || !sid.current) return;
    setTyped("");
    setCaption({ who: "me", text: t });
    setThinking(true);
    const r = await post(`/api/call/${sid.current}/chat`, { text: t });
    const j = await r.json();
    setThinking(false);
    if (j.reply) speakDemo(j.reply);
  }

  // =============================================================== UI ===========================================
  if (phase === "ended") {
    return (
      <div className="card max-w-lg mx-auto text-center py-10 fade-up">
        <div className="w-32 h-32 mx-auto rounded-full overflow-hidden"><Avatar avatar={agent.avatar} className="w-full h-full" /></div>
        <h1 className="text-3xl font-semibold mt-5">Sessão encerrada</h1>
        <p className="text-ink-soft mt-3 leading-relaxed">Obrigado por esse tempo, {agent.preferredName}. {agent.name} está preparando o resumo da conversa e o que ficou combinado para você.</p>
        {err && <p className="text-sm text-coral-ink mt-3">{err}</p>}
        {sid.current && (
          <div className="mt-6 text-left bg-teal-soft/60 rounded-2xl p-4">
            {fb.sent ? (
              <p className="text-center text-sm text-ink-soft">Obrigado por contar. Isso ajuda {agent.name} a cuidar melhor das próximas conversas.</p>
            ) : (
              <>
                <p className="font-semibold text-center">Como foi essa conversa pra você?</p>
                <div className="grid grid-cols-3 gap-2 mt-3" role="group" aria-label="Avaliação da conversa">
                  {[{ r: 3, e: "face-5" as const, t: "Me ajudou" }, { r: 2, e: "face-3" as const, t: "Mais ou menos" }, { r: 1, e: "face-2" as const, t: "Não ajudou" }].map((o) => (
                    <button key={o.r} type="button" style={{ textAlign: "center" }} className="choice !px-2 !py-3" aria-pressed={fb.rating === o.r} onClick={() => setFb((f) => ({ ...f, rating: o.r }))}>
                      <Icon name={o.e} size={28} className="mx-auto" />
                      <div className="text-xs mt-1">{o.t}</div>
                    </button>
                  ))}
                </div>
                {fb.rating != null && (
                  <>
                    <label className="label mt-3" htmlFor="fb_note">{fb.rating === 1 ? "O que poderia ter sido diferente?" : "Quer contar mais? (opcional)"}</label>
                    <textarea id="fb_note" className="input" rows={2} maxLength={600} value={fb.note} onChange={(e) => setFb((f) => ({ ...f, note: e.target.value }))} placeholder="Escreva do seu jeito. Só a coordenação do estudo vê isso." />
                    <button
                      type="button"
                      className="btn btn-primary w-full mt-3"
                      disabled={fb.busy}
                      onClick={async () => {
                        setFb((f) => ({ ...f, busy: true }));
                        try {
                          const r = await post(`/api/call/${sid.current}/feedback`, { rating: fb.rating, note: fb.note });
                          if (r.ok) setFb((f) => ({ ...f, sent: true }));
                        } finally {
                          setFb((f) => ({ ...f, busy: false }));
                        }
                      }}
                    >
                      {fb.busy ? "Enviando…" : "Enviar"}
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}
        <div className="mt-7 flex justify-center gap-3"><Link href="/app/sessoes" className="btn btn-primary">Ver minhas sessões</Link><Link href="/app" className="btn btn-ghost">Voltar ao início</Link></div>
        <p className="text-xs text-muted mt-6">Se precisar de apoio agora: 188 (CVV, 24h) · 192 (SAMU)</p>
      </div>
    );
  }

  if (phase === "lobby" || phase === "connecting" || phase === "error") {
    return (
      <div className="max-w-4xl mx-auto grid md:grid-cols-[1.3fr_1fr] gap-6 items-center">
        <div className="relative rounded-3xl overflow-hidden bg-night aspect-video shadow-lg">
          {camOn ? <video ref={selfVideo} autoPlay muted playsInline className="w-full h-full object-cover [transform:scaleX(-1)]" /> : <div className="w-full h-full grid place-items-center text-white/70"><div className="text-center"><Icon name="mic" size={44} className="mx-auto mb-2" /><p className="text-sm">Câmera desligada</p></div></div>}
          <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 text-white text-xs">
            <div className="h-1.5 flex-1 rounded-full bg-white/20 overflow-hidden"><div className="h-full bg-teal transition-[width] duration-75" style={{ width: `${micLevel * 100}%` }} /></div><span>teste de microfone</span>
          </div>
        </div>
        <div>
          <h1 className="text-3xl font-semibold">{resumable ? "Voltar para a chamada" : first ? "Pronto para a primeira conversa?" : "Pronto para entrar?"}</h1>
          <p className="text-ink-soft mt-2">{agent.name} vai estar do outro lado. A sessão dura até {maxMinutes} minutos e é encerrada com calma ao final.</p>
          <ol className="mt-4 space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="mt-0.5 w-6 h-6 rounded-full bg-teal-soft text-teal-deep grid place-items-center text-xs font-bold shrink-0">1</span>
              <span><strong>Fones de ouvido</strong>, se tiver: evitam eco e deixam a conversa mais fiel. Escolha um lugar tranquilo.</span>
            </li>
            <li className="flex gap-3">
              <span className={`mt-0.5 w-6 h-6 rounded-full grid place-items-center text-xs font-bold shrink-0 ${micState === "ok" ? "bg-teal text-white" : "bg-teal-soft text-teal-deep"}`}>{micState === "ok" ? <Icon name="check" size={14} strokeWidth={3} /> : "2"}</span>
              <span className="flex-1">
                <strong>Teste o microfone</strong>
                {micState === "idle" && <span className="block text-muted">Toque no botão e diga “oi” em voz normal.</span>}
                {micState === "listening" && <span className="block text-muted">Estou ouvindo… diga “oi” em voz normal.</span>}
                {micState === "ok" && <span className="block text-teal-deep font-semibold"><Icon name="check" size={14} strokeWidth={3} className="mr-1 -mt-0.5" />Estou te ouvindo bem</span>}
                {micState === "silent" && <span className="block text-coral-ink">Ainda não ouvi nada. Fale um pouco mais alto e mais perto, confira se o microfone certo está selecionado e se o navegador deixou usar o microfone.</span>}
              </span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 w-6 h-6 rounded-full bg-teal-soft text-teal-deep grid place-items-center text-xs font-bold shrink-0">3</span>
              <span><strong>{agent.name} fala primeiro</strong>. Pode levar 2 ou 3 segundos para a voz começar, é normal. Depois é só conversar, como numa ligação.</span>
            </li>
          </ol>
          <ul className="mt-4 text-xs text-muted space-y-1">
            <li>• Sua câmera é opcional; o vídeo <strong>nunca é enviado nem gravado</strong>. Só o áudio é usado.</li>
            <li>• Você está falando com uma IA, com a equipe do estudo acompanhando.</li>
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <button className={`btn ${micState === "ok" ? "btn-ghost" : "btn-primary"}`} onClick={startMicPreview}>{micState === "idle" ? "Testar microfone" : "Testar de novo"}</button>
            <button className="btn btn-ghost" onClick={toggleCam}>{camOn ? "Desligar câmera" : "Ligar câmera"}</button>
          </div>
          {err && <p role="alert" className="mt-4 text-sm text-coral-ink bg-coral-soft rounded-xl px-3 py-2">{err}</p>}
          <button className={`btn mt-5 w-full text-base ${micState === "ok" || micState === "idle" ? "btn-primary" : "btn-ghost"}`} onClick={join} disabled={phase === "connecting"}>{phase === "connecting" ? "Conectando…" : resumable ? "Retomar chamada" : "Entrar na chamada"}</button>
        </div>
      </div>
    );
  }

  const low = secs <= 300;
  return (
    <div className="fixed inset-0 z-30 bg-[#0b1220] text-white flex flex-col">
      {needsSound && (
        <button
          className="absolute z-40 left-1/2 -translate-x-1/2 top-16 rounded-full bg-amber-400 text-black px-4 py-2 text-sm font-semibold shadow-lg"
          onClick={() => {
            void audioEl.current?.play().then(() => setNeedsSound(false)).catch(() => {});
            void actx.current?.resume();
          }}
        >
          <Icon name="volume" size={16} className="mr-1.5 -mt-0.5" />Toque para ativar o som
        </button>
      )}
      {reconnecting && <div role="status" className="absolute z-40 left-1/2 -translate-x-1/2 top-16 rounded-full bg-amber-400 text-black px-4 py-2 text-sm font-semibold shadow-lg animate-pulse">Reconectando… sua conversa continua de onde parou</div>}
      {toast && <div role="status" className="absolute z-40 left-1/2 -translate-x-1/2 bottom-28 rounded-full bg-white/90 text-black px-4 py-2 text-sm shadow-lg">{toast}</div>}
      {err && phase === "live" && <p role="alert" className="absolute z-40 left-1/2 -translate-x-1/2 top-28 max-w-md w-[90%] text-sm text-coral-ink bg-coral-soft rounded-xl px-3 py-2">{err}</p>}
      <div className="flex items-center justify-between px-4 py-3 text-sm">
        <div className="flex items-center gap-3">
          <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1 font-mono ${low ? "bg-coral text-white" : "bg-white/10"}`}><span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />{mmss(secs)}</span>
          {demo && <span className="rounded-full bg-amber-400 text-black px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap">Demonstração · sem IA real</span>}
        </div>
        <a href="tel:188" className="rounded-full bg-white/10 hover:bg-white/20 px-3 py-1 text-xs whitespace-nowrap"><span className="hidden sm:inline">Precisa de ajuda agora? 188</span><span className="sm:hidden">Ajuda: 188</span></a>
      </div>

      <div className="flex-1 relative min-h-0 px-3 pb-3">
        <div className="h-full w-full max-w-5xl mx-auto relative rounded-3xl overflow-hidden bg-black/30 ring-1 ring-white/10">
          <Avatar avatar={agent.avatar} getLevel={getLevel} thinking={thinking} mood={faceMood} className="w-full h-full" />
          <div className="absolute left-4 bottom-4 text-sm bg-black/50 rounded-lg px-2.5 py-1">{agent.name} · IA</div>

          {captions && caption && (
            <div className="absolute left-1/2 -translate-x-1/2 bottom-28 sm:bottom-16 max-w-[min(92%,640px)] text-center">
              <p className="inline-block rounded-xl bg-black/70 px-4 py-2 text-[15px] leading-snug">{caption.who === "me" && <span className="text-teal opacity-90">Você: </span>}{caption.text}</p>
              {caption.who === "me" && fixable && !demo && (
                <button className="block mx-auto mt-1 text-xs underline text-white/80 hover:text-white" onClick={wrongCaption}>Não foi isso que eu disse</button>
              )}
            </div>
          )}

          {crisis && (
            <div className="absolute top-4 left-4 right-4 sm:left-auto sm:w-80 rounded-2xl bg-coral-soft text-ink p-4 text-sm shadow-xl fade-up">
              <p className="font-semibold">Você não está só.</p>
              <p className="mt-1">Se estiver em perigo agora, ligue <strong>188</strong> (CVV, 24h) ou <strong>192</strong> (SAMU). Posso ficar aqui com você enquanto isso.</p>
              <button className="text-xs underline mt-2" onClick={() => setCrisis(false)}>fechar</button>
            </div>
          )}

          <div className="absolute right-3 bottom-3 w-32 sm:w-44 aspect-[4/3] rounded-2xl overflow-hidden bg-[#1c2538] ring-1 ring-white/20 shadow-lg">
            {camOn ? <video ref={selfVideo} autoPlay muted playsInline className="w-full h-full object-cover [transform:scaleX(-1)]" /> : <div className="w-full h-full grid place-items-center"><div className="w-12 h-12 rounded-full bg-teal grid place-items-center text-lg font-semibold">{agent.preferredName[0]?.toUpperCase()}</div></div>}
            {muted && <span className="absolute top-1.5 left-1.5 text-[10px] bg-red-600 rounded px-1.5 py-0.5">mudo</span>}
          </div>

          {secs <= 300 && secs > 0 && <div className="absolute top-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-4 py-1.5 text-xs">Nossa sessão está chegando ao fim — {agent.name} vai fechar com você com calma.</div>}
        </div>
      </div>

      {demo && (
        <form onSubmit={sendTyped} className="px-4 pb-2 max-w-2xl mx-auto w-full flex gap-2">
          <input className="input !bg-white/10 !border-white/20 text-white placeholder:text-white/40" placeholder="Modo demonstração: digite o que você diria" value={typed} onChange={(e) => setTyped(e.target.value)} />
          <button className="btn btn-primary">Enviar</button>
        </form>
      )}

      <div className="flex items-center justify-center gap-3 pb-6 pt-2">
        <button onClick={toggleMute} aria-pressed={muted} aria-label={muted ? "Ativar microfone" : "Silenciar microfone"} className={`w-12 h-12 rounded-full grid place-items-center text-lg ${muted ? "bg-red-600" : "bg-white/15 hover:bg-white/25"}`}><Icon name={muted ? "mic-off" : "mic"} size={22} /></button>
        <button onClick={toggleCam} aria-pressed={camOn} aria-label={camOn ? "Desligar câmera" : "Ligar câmera"} className={`w-12 h-12 rounded-full grid place-items-center text-lg ${camOn ? "bg-white/25" : "bg-white/10 hover:bg-white/20"}`}><Icon name={camOn ? "video" : "video-off"} size={22} /></button>
        {!demo && <button onClick={notHelping} aria-label="Não está ajudando: pedir para mudar de jeito" title="Não está ajudando" className="h-12 px-4 rounded-full bg-white/10 hover:bg-white/20 text-sm font-semibold whitespace-nowrap"><Icon name="help" size={20} className="sm:mr-1.5 sm:-mt-0.5" /><span className="hidden sm:inline">Não está ajudando</span></button>}
        <button onClick={() => setCaptions(!captions)} aria-pressed={captions} aria-label="Legendas" className={`w-12 h-12 rounded-full grid place-items-center text-xs font-bold ${captions ? "bg-white/25" : "bg-white/10 hover:bg-white/20"}`}>CC</button>
        <button onClick={() => { if (confirm("Encerrar a chamada agora? Seu direito de hoje será considerado usado.")) void finish("paciente"); }} aria-label="Encerrar chamada" className="h-12 px-6 rounded-full bg-red-600 hover:bg-red-500 font-semibold">Encerrar</button>
      </div>
    </div>
  );
}
