"use client";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "./Avatar";
import { ACCENTS, ACCESSORIES, AVATAR_DEFAULT, FACES, FACIAL_HAIR, FORMALITIES, GENDERS, HAIR_COLORS, HAIR_STYLES, HUMORS, PACES, PATIENT_GENDERS, SKIN_TONES, STYLES, TONES, VOICES, VOICE_GENDER, type Avatar as AvatarT, type GenderKey } from "@/lib/prompts/options";

/** Botão ▶ que toca uma amostra da voz (um áudio por vez; sem chave da OpenAI usa a voz do navegador). */
function useVoicePreview() {
  const [state, setState] = useState<{ id: string; status: "loading" | "playing" | "error" } | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const urls = useRef<Map<string, string>>(new Map());
  const stop = () => {
    audio.current?.pause();
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    setState(null);
  };
  useEffect(() => () => {
    audio.current?.pause();
    if (typeof speechSynthesis !== "undefined") speechSynthesis.cancel();
    urls.current.forEach((u) => URL.revokeObjectURL(u));
  }, []);
  async function toggle(id: string) {
    if (state?.id === id) return stop();
    stop();
    setState({ id, status: "loading" });
    try {
      let url = urls.current.get(id);
      if (!url) {
        const r = await fetch(`/api/voice-preview?voice=${encodeURIComponent(id)}`);
        if (!r.ok) throw new Error("falha");
        if ((r.headers.get("content-type") ?? "").includes("json")) {
          const j = (await r.json()) as { mock?: boolean; text?: string };
          if (j.mock && typeof speechSynthesis !== "undefined") {
            const u = new SpeechSynthesisUtterance(j.text ?? "");
            u.lang = "pt-BR";
            u.onend = u.onerror = () => setState(null);
            setState({ id, status: "playing" });
            speechSynthesis.speak(u);
            return;
          }
          throw new Error("sem prévia");
        }
        url = URL.createObjectURL(await r.blob());
        urls.current.set(id, url);
      }
      const a = (audio.current ??= new Audio());
      a.src = url;
      a.onended = () => setState(null);
      await a.play();
      setState({ id, status: "playing" });
    } catch {
      setState({ id, status: "error" });
    }
  }
  return { state, toggle };
}

export type AgentForm = {
  preferred_name: string;
  agent_name: string;
  agent_gender: string;
  patient_gender: string;
  voice: string;
  tone: string;
  style: string;
  formality: string;
  humor: string;
  pace: string;
  avatar: AvatarT;
  about_me: string;
  topics: string;
  boundaries: string;
  goal_hint: string;
};

export const defaultAgentForm = (name = ""): AgentForm => ({
  preferred_name: name,
  agent_name: "",
  agent_gender: "f",
  patient_gender: "n",
  voice: "marin",
  tone: "acolhedor",
  style: "equilibrado",
  formality: "informal",
  humor: "leve",
  pace: "normal",
  avatar: { ...AVATAR_DEFAULT },
  about_me: "",
  topics: "",
  boundaries: "",
  goal_hint: "",
});

const NAME_IDEAS: Record<GenderKey, string[]> = {
  f: ["Íris", "Alma", "Luna", "Clara", "Aurora", "Maria"],
  m: ["Leo", "Théo", "Davi", "Caio", "Gael", "Rafa"],
};
const ALL_IDEAS = new Set([...NAME_IDEAS.f, ...NAME_IDEAS.m]);

type P = { form: AgentForm; set: (patch: Partial<AgentForm>) => void };

function Swatches({ colors, value, onPick, label }: { colors: string[]; value: string; onPick: (c: string) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {colors.map((c) => (
        <button key={c} type="button" aria-label={c} aria-pressed={value === c} onClick={() => onPick(c)} className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110" style={{ background: c, borderColor: value === c ? "#0f1829" : "#fff", boxShadow: "0 0 0 1px #e6e1d6" }} />
      ))}
    </div>
  );
}

export function IdentityFields({ form, set }: P) {
  const preview = useVoicePreview();
  const setAv = (p: Partial<AvatarT>) => set({ avatar: { ...form.avatar, ...p } });
  // Trocar o gênero ajusta rosto e voz sugeridos (e tira barba se voltar ao feminino), sem apagar o resto das escolhas.
  const pickGender = (g: GenderKey) => {
    const wasVoiceDefault = (VOICE_GENDER[form.voice] ?? "f") !== g;
    // Nome: se está vazio ou ainda é uma das sugestões do outro gênero, troca por uma sugestão do gênero escolhido; nome digitado pela pessoa nunca é mexido.
    const keepName = form.agent_name.trim() && !ALL_IDEAS.has(form.agent_name.trim());
    set({
      agent_gender: g,
      agent_name: keepName ? form.agent_name : NAME_IDEAS[g][0],
      voice: wasVoiceDefault ? GENDERS[g].defaultVoice : form.voice,
      avatar: { ...form.avatar, face: GENDERS[g].defaultFace, facial: g === "f" ? "none" : form.avatar.facial, hair: g === "m" && ["hair-long", "hair-bun"].includes(form.avatar.hair) ? "hair-short" : form.avatar.hair },
    });
  };
  return (
    <div className="grid md:grid-cols-[240px_1fr] gap-8">
      <div>
        <div className="rounded-3xl overflow-hidden aspect-square border border-line shadow-sm sticky top-4">
          <Avatar avatar={form.avatar} className="w-full h-full" />
        </div>
      </div>
      <div className="space-y-5">
        <div>
          <span className="label">Quem é o seu acompanhante?</span>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Gênero do acompanhante">
            {(Object.entries(GENDERS) as [GenderKey, (typeof GENDERS)[GenderKey]][]).map(([k, g]) => (
              <button key={k} type="button" className="choice" aria-pressed={form.agent_gender === k} onClick={() => pickGender(k)}>
                <div className="font-semibold">{g.label}</div>
                <div className="text-xs text-muted">{g.desc}</div>
              </button>
            ))}
          </div>
          <p className="hint">Define como ele(a) fala de si e o rosto inicial. Você ainda ajusta aparência e voz livremente abaixo.</p>
        </div>
        <div>
          <label className="label" htmlFor="agent_name">Como o seu acompanhante vai se chamar?</label>
          <input id="agent_name" className="input" value={form.agent_name} maxLength={30} onChange={(e) => set({ agent_name: e.target.value })} placeholder="Ex.: Alma, Leo, Íris…" />
          <div className="flex flex-wrap items-center gap-1.5 mt-2" aria-label="Sugestões de nome">
            <span className="text-xs text-muted">Ideias:</span>
            {NAME_IDEAS[form.agent_gender === "m" ? "m" : "f"].map((n) => <button key={n} type="button" className="chip !py-0.5 !text-xs" aria-pressed={form.agent_name === n} onClick={() => set({ agent_name: n })}>{n}</button>)}
          </div>
        </div>
        <div>
          <span className="label">Voz <span className="font-normal text-muted">· as primeiras combinam com o gênero escolhido, mas você pode usar qualquer uma</span></span>
          <div className="grid sm:grid-cols-2 gap-2">
            {[...VOICES].sort((a, b) => Number((VOICE_GENDER[b.id] ?? "f") === (form.agent_gender === "m" ? "m" : "f")) - Number((VOICE_GENDER[a.id] ?? "f") === (form.agent_gender === "m" ? "m" : "f"))).map((v) => {
              const st = preview.state?.id === v.id ? preview.state.status : null;
              return (
                <div key={v.id} className="relative">
                  <button type="button" className="choice w-full pr-14" aria-pressed={form.voice === v.id} onClick={() => set({ voice: v.id })}>
                    <div className="font-semibold">{v.label}</div>
                    <div className="text-xs text-muted">{st === "error" ? "Não foi possível tocar a prévia" : v.desc}</div>
                  </button>
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-teal text-white grid place-items-center text-sm hover:opacity-90"
                    onClick={() => void preview.toggle(v.id)}
                    aria-label={st === "playing" ? `Parar a prévia da voz ${v.label}` : `Ouvir a voz ${v.label}`}
                  >
                    {st === "loading" ? <span className="animate-pulse">…</span> : st === "playing" ? "■" : "▶"}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
        <div>
          <span className="label">Traços do rosto</span>
          <div className="flex flex-wrap gap-2">
            {FACES.map((f) => <button key={f.id} type="button" className="chip" aria-pressed={form.avatar.face === f.id} onClick={() => setAv({ face: f.id })}>{f.label}</button>)}
          </div>
        </div>
        <div>
          <span className="label">Cabelo</span>
          <div className="flex flex-wrap gap-2">
            {HAIR_STYLES.map((h) => (
              <button key={h.id} type="button" className="chip" aria-pressed={form.avatar.hair === h.id} onClick={() => setAv({ hair: h.id })}>{h.label}</button>
            ))}
          </div>
        </div>
        <div>
          <span className="label">Barba e bigode</span>
          <div className="flex flex-wrap gap-2">
            {FACIAL_HAIR.map((f) => <button key={f.id} type="button" className="chip" aria-pressed={(form.avatar.facial ?? "none") === f.id} onClick={() => setAv({ facial: f.id })}>{f.label}</button>)}
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-5">
          <div><span className="label">Tom de pele</span><Swatches label="Tom de pele" colors={SKIN_TONES} value={form.avatar.skin} onPick={(c) => setAv({ skin: c })} /></div>
          <div><span className="label">Cor do cabelo</span><Swatches label="Cor do cabelo" colors={HAIR_COLORS} value={form.avatar.hairColor} onPick={(c) => setAv({ hairColor: c })} /></div>
        </div>
        <div>
          <span className="label">Acessório</span>
          <div className="flex flex-wrap gap-2">
            {ACCESSORIES.map((a) => (
              <button key={a.id} type="button" className="chip" aria-pressed={form.avatar.accessory === a.id} onClick={() => setAv({ accessory: a.id })}>{a.label}</button>
            ))}
          </div>
        </div>
        <div><span className="label">Cor do ambiente</span><Swatches label="Cor do ambiente" colors={ACCENTS} value={form.avatar.accent} onPick={(c) => setAv({ accent: c })} /></div>
      </div>
    </div>
  );
}

function Options<T extends Record<string, { label: string; desc: string }>>({ title, map, value, onPick }: { title: string; map: T; value: string; onPick: (k: string) => void }) {
  return (
    <div>
      <span className="label">{title}</span>
      <div className="grid sm:grid-cols-2 gap-2">
        {Object.entries(map).map(([k, v]) => (
          <button key={k} type="button" className="choice" aria-pressed={value === k} onClick={() => onPick(k)}>
            <div className="font-semibold">{v.label}</div>
            <div className="text-xs text-muted">{v.desc}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function PersonalityFields({ form, set }: P) {
  return (
    <div className="space-y-6">
      <Options title="Tom de voz" map={TONES} value={form.tone} onPick={(tone) => set({ tone })} />
      <Options title="Estilo das conversas" map={STYLES} value={form.style} onPick={(style) => set({ style })} />
      <div className="grid md:grid-cols-3 gap-6">
        <Options title="Linguagem" map={FORMALITIES} value={form.formality} onPick={(formality) => set({ formality })} />
        <Options title="Humor" map={HUMORS} value={form.humor} onPick={(humor) => set({ humor })} />
        <Options title="Ritmo" map={PACES} value={form.pace} onPick={(pace) => set({ pace })} />
      </div>
    </div>
  );
}

export function AboutFields({ form, set }: P) {
  return (
    <div className="space-y-5">
      <div>
        <label className="label" htmlFor="pn">Como você gosta de ser chamado(a)?</label>
        <input id="pn" className="input" value={form.preferred_name} maxLength={40} onChange={(e) => set({ preferred_name: e.target.value })} />
      </div>
      <div>
        <span className="label">Como você prefere ser tratado(a)?</span>
        <div className="grid sm:grid-cols-3 gap-2" role="group" aria-label="Como prefere ser tratado">
          {(Object.entries(PATIENT_GENDERS) as [string, { label: string; desc: string }][]).map(([k, g]) => (
            <button key={k} type="button" className="choice" aria-pressed={form.patient_gender === k} onClick={() => set({ patient_gender: k })}>
              <div className="font-semibold">{g.label}</div>
              <div className="text-xs text-muted">{g.desc}</div>
            </button>
          ))}
        </div>
        <p className="hint">Assim o seu acompanhante usa as palavras certas ao falar com você.</p>
      </div>
      <div>
        <label className="label" htmlFor="about">Algo que você queira que o seu acompanhante saiba sobre você <span className="font-normal text-muted">(opcional)</span></label>
        <textarea id="about" className="input min-h-24" maxLength={600} value={form.about_me} onChange={(e) => set({ about_me: e.target.value })} placeholder="Ex.: sou estudante, moro com minha irmã, gosto de música…" />
      </div>
      <div>
        <label className="label" htmlFor="goal">O que você espera conseguir <span className="font-normal text-muted">(opcional)</span></label>
        <textarea id="goal" className="input min-h-20" maxLength={400} value={form.goal_hint} onChange={(e) => set({ goal_hint: e.target.value })} placeholder="Ex.: dormir melhor, me sentir menos ansioso(a) no trabalho…" />
      </div>
      <div>
        <label className="label" htmlFor="topics">Assuntos que você gostaria de trabalhar <span className="font-normal text-muted">(opcional)</span></label>
        <textarea id="topics" className="input min-h-20" maxLength={400} value={form.topics} onChange={(e) => set({ topics: e.target.value })} placeholder="Ex.: ansiedade, relacionamentos, autoestima, rotina…" />
      </div>
      <div>
        <label className="label" htmlFor="bound">Assuntos que você prefere não abordar por enquanto <span className="font-normal text-muted">(opcional)</span></label>
        <textarea id="bound" className="input min-h-20" maxLength={400} value={form.boundaries} onChange={(e) => set({ boundaries: e.target.value })} placeholder="Ele respeita isso e só entra no assunto se você quiser." />
      </div>
    </div>
  );
}
