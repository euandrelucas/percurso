"use client";
import { Avatar } from "./Avatar";
import { ACCENTS, ACCESSORIES, AVATAR_DEFAULT, FACES, FACIAL_HAIR, FORMALITIES, GENDERS, HAIR_COLORS, HAIR_STYLES, HUMORS, PACES, PATIENT_GENDERS, SKIN_TONES, STYLES, TONES, VOICES, VOICE_GENDER, type Avatar as AvatarT, type GenderKey } from "@/lib/prompts/options";

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
  const setAv = (p: Partial<AvatarT>) => set({ avatar: { ...form.avatar, ...p } });
  // Trocar o gênero ajusta rosto e voz sugeridos (e tira barba se voltar ao feminino), sem apagar o resto das escolhas.
  const pickGender = (g: GenderKey) => {
    const wasVoiceDefault = (VOICE_GENDER[form.voice] ?? "f") !== g;
    set({
      agent_gender: g,
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
        </div>
        <div>
          <span className="label">Voz</span>
          <div className="grid sm:grid-cols-2 gap-2">
            {VOICES.map((v) => (
              <button key={v.id} type="button" className="choice" aria-pressed={form.voice === v.id} onClick={() => set({ voice: v.id })}>
                <div className="font-semibold">{v.label}</div>
                <div className="text-xs text-muted">{v.desc}</div>
              </button>
            ))}
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
