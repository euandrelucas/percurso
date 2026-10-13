"use client";
import { useEffect, useId, useRef, useState } from "react";
import type { Avatar as AvatarT } from "@/lib/prompts/options";

// ---- utilidades de cor ---------------------------------------------------------------------------------------------
const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const toHex = (c: number[]) => "#" + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");
/** Mistura `a` com `b` (t: 0..1). */
const mix = (a: string, b: string, t: number) => {
  const x = rgb(a), y = rgb(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
};
const darken = (c: string, t: number) => mix(c, "#000000", t);
const lighten = (c: string, t: number) => mix(c, "#ffffff", t);

export const avatarBackground = (accent: string) => `radial-gradient(120% 90% at 50% 18%, ${lighten(accent, 0.28)}, ${accent} 52%, ${darken(accent, 0.55)} 135%)`;

type Props = {
  avatar: AvatarT;
  /** Nível de áudio 0..1 lido continuamente (sem re-render do pai). */
  getLevel?: () => number;
  level?: number;
  speaking?: boolean;
  thinking?: boolean;
  className?: string;
  /** Sem fundo próprio. */
  bare?: boolean;
  framing?: "bust" | "face";
};

/**
 * Rosto ilustrado (SVG) com animações: respiração, piscar, olhar, balanço da cabeça ao falar e boca sincronizada
 * ao nível de áudio. Personalizável: pele, estilo/cor do cabelo, óculos e cor do ambiente.
 */
export function Avatar({ avatar, getLevel, level = 0, speaking, thinking, className, bare, framing = "bust" }: Props) {
  const uid = useId().replace(/:/g, "");
  const [lvl, setLvl] = useState(level);
  const smooth = useRef(0);
  const getRef = useRef(getLevel);
  getRef.current = getLevel;
  const staticLevel = useRef(level);
  staticLevel.current = speaking && !getLevel && level === 0 ? 0.35 : level;

  useEffect(() => {
    let raf = 0;
    let last = 0;
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      if (t - last < 40) return;
      last = t;
      const target = getRef.current ? getRef.current() : staticLevel.current;
      smooth.current += (target - smooth.current) * (target > smooth.current ? 0.6 : 0.3);
      setLvl((p) => (Math.abs(smooth.current - p) > 0.015 ? smooth.current : p));
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const { skin, hair, hairColor, accessory, accent } = avatar;
  const masc = avatar.face === "masc";
  const facial = avatar.facial ?? "none";
  const skinD = darken(skin, 0.14);
  const skinDD = darken(skin, 0.3);
  const skinL = lighten(skin, 0.1);
  const lip = mix(darken(skin, 0.12), masc ? "#a4505a" : "#b8434f", masc ? 0.42 : 0.6);
  const lipL = lighten(lip, 0.18);
  const hD = darken(hairColor, 0.3);
  const hL = lighten(hairColor, 0.22);
  const shirt = mix(accent, "#1b2233", 0.45);
  const shirtL = mix(accent, "#ffffff", 0.08);
  const browC = hair === "hair-none" ? darken(skin, 0.5) : darken(hairColor, 0.12);

  const o = Math.min(1, lvl * 1.3) * 18; // abertura da boca (px no viewBox)
  const talking = lvl > 0.06 || speaking;
  const blinkDelay = `${(uid.length % 5) * 0.7}s`;

  const eye = (cx: number, side: 1 | -1) => {
    const d = `M${cx - 26} 176 Q${cx} 154 ${cx + 26} 176 Q${cx} 192 ${cx - 26} 176 Z`;
    const id = `eye${uid}${side}`;
    const gaze = thinking ? `translate(${side * -1 - 2}px,-4px)` : "translate(0,0)";
    return (
      <g key={side}>
        <clipPath id={id}><path d={d} /></clipPath>
        <path d={d} fill="#fbfbfd" />
        <g clipPath={`url(#${id})`}>
          <g style={{ transform: gaze, transition: "transform .3s ease" }} className={thinking ? "" : "av-wander"}>
            <circle cx={cx} cy={174} r={13} fill="#6b4328" />
            <circle cx={cx} cy={174} r={13} fill="none" stroke="#3a2412" strokeWidth="2" />
            <circle cx={cx} cy={174} r={6.2} fill="#120c0a" />
            <circle cx={cx + 4.5} cy={169.5} r={3.2} fill="#fff" />
            <circle cx={cx - 4} cy={179} r={1.6} fill="#fff" opacity=".8" />
          </g>
          <path d={`M${cx - 30} 150 Q${cx} 152 ${cx + 30} 150 L${cx + 30} 164 Q${cx} 158 ${cx - 30} 164 Z`} fill={darken(skin, 0.16)} opacity=".35" />
          {/* pálpebra: desliza sobre o olho ao piscar */}
          <g className="av-lid" style={{ animationDelay: blinkDelay }}>
            <rect x={cx - 34} y={140} width="68" height="44" fill={skin} />
            <path d={`M${cx - 27} 183 Q${cx} 190 ${cx + 27} 183`} stroke="#2a1a16" strokeWidth="3.4" fill="none" strokeLinecap="round" />
          </g>
        </g>
        <path d={`M${cx - 28} 177 Q${cx} 150 ${cx + 28} 177`} stroke="#2a1a16" strokeWidth={masc ? 3.4 : 4.2} fill="none" strokeLinecap="round" />
        {!masc && <path d={`M${cx + side * -27} 176 L${cx + side * -33} 171`} stroke="#2a1a16" strokeWidth="3.2" strokeLinecap="round" />}
        <path d={`M${cx - 22} 184 Q${cx} 193 ${cx + 22} 184`} stroke={skinDD} strokeWidth="1.8" fill="none" opacity=".45" strokeLinecap="round" />
        <path d={`M${cx - 24} 160 Q${cx} 144 ${cx + 24} 160`} stroke={skinD} strokeWidth="2.2" fill="none" opacity=".55" strokeLinecap="round" />
      </g>
    );
  };

  // ---- cabelo ---------------------------------------------------------------------------------------------------------
  const hairBack = () => {
    switch (hair) {
      case "hair-long":
        return <path d="M100 168 C92 68 148 40 200 40 C252 40 308 68 300 168 L316 340 Q200 372 84 340 Z" fill={hD} />;
      case "hair-curly":
        return (
          <g fill={hD}>
            <ellipse cx="200" cy="148" rx="112" ry="108" />
            {[[96, 196], [304, 196], [88, 168], [312, 168], [104, 222], [296, 222]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="26" />)}
          </g>
        );
      case "hair-bun":
        return <circle cx="200" cy="50" r="32" fill={hD} />;
      case "hair-afro":
        return (
          <g fill={hD}>
            <ellipse cx="200" cy="124" rx="130" ry="110" />
            {[[84, 150, 30], [316, 150, 30], [96, 100, 32], [304, 100, 32], [130, 48, 34], [200, 28, 36], [270, 48, 34], [78, 196, 24], [322, 196, 24]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} />)}
          </g>
        );
      default:
        return null;
    }
  };
  const hairFront = () => {
    switch (hair) {
      case "hair-short":
        return (
          <g>
            <path d="M110 176 C98 92 146 46 204 46 C264 46 306 94 290 176 C286 148 278 128 262 114 C244 104 224 98 206 100 C180 104 150 116 134 140 C124 152 116 164 110 176 Z" fill={hairColor} />
            <path d="M138 120 C150 96 176 82 206 82 C232 82 256 94 268 114" stroke={hL} strokeWidth="5" fill="none" strokeLinecap="round" opacity=".5" />
            <path d="M110 176 C114 160 122 150 134 140 C128 154 124 166 124 184 Z" fill={hD} />
          </g>
        );
      case "hair-long":
        return (
          <g>
            <path d="M110 178 C98 92 146 44 202 44 C262 44 306 94 290 178 C284 150 270 126 248 112 C232 106 216 104 202 104 C186 106 168 108 152 116 C130 128 118 152 110 178 Z" fill={hairColor} />
            <path d="M140 118 C152 92 178 78 208 78 C236 78 258 92 270 112" stroke={hL} strokeWidth="5" fill="none" strokeLinecap="round" opacity=".45" />
            <path d="M110 176 C102 226 96 282 90 338 L128 338 C126 282 130 226 128 170 L120 160 Z" fill={hairColor} />
            <path d="M290 176 C298 226 304 282 310 338 L272 338 C274 282 270 226 272 170 L280 160 Z" fill={hairColor} />
            <path d="M112 200 C106 250 102 290 100 332" stroke={hL} strokeWidth="4" fill="none" strokeLinecap="round" opacity=".35" />
          </g>
        );
      case "hair-buzz":
        return <path d="M113 170 C106 98 148 64 200 64 C252 64 294 98 287 170 C283 140 270 112 246 100 C228 94 214 98 200 98 C186 98 172 94 154 100 C130 112 117 140 113 170 Z" fill={hairColor} opacity=".92" />;
      case "hair-quiff":
        return (
          <g>
            <path d="M112 172 C100 98 140 50 204 44 C268 40 302 92 288 172 C284 144 274 124 258 112 C240 100 214 96 192 98 C162 102 142 120 132 142 C124 154 116 162 112 172 Z" fill={hairColor} />
            <path d="M126 112 C132 60 196 34 258 66 C290 82 300 112 292 140 C282 104 250 82 214 82 C176 82 140 92 126 112 Z" fill={hairColor} />
            <path d="M146 92 C170 66 214 58 248 74" stroke={hL} strokeWidth="6" fill="none" strokeLinecap="round" opacity=".5" />
          </g>
        );
      case "hair-afro":
        return (
          <g>
            <path d="M120 156 C116 106 150 76 200 76 C250 76 284 106 280 156 C264 126 238 112 200 112 C162 112 136 126 120 156 Z" fill={hairColor} />
            {[[150, 92], [186, 80], [222, 80], [254, 94]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="13" fill={hL} opacity=".28" />)}
          </g>
        );
      case "hair-curly":
        return (
          <g>
            {[[132, 112, 24], [160, 92, 26], [194, 84, 27], [228, 90, 26], [260, 106, 25], [284, 134, 22], [118, 138, 20], [176, 104, 20], [214, 100, 20], [246, 118, 18], [146, 122, 18]].map(([x, y, r], i) => (
              <circle key={i} cx={x} cy={y} r={r} fill={i % 3 === 0 ? hL : hairColor} />
            ))}
            {[[136, 100], [172, 88], [212, 84], [250, 96]].map(([x, y], i) => <circle key={`h${i}`} cx={x} cy={y} r="8" fill={hL} opacity=".35" />)}
          </g>
        );
      case "hair-bun":
        return (
          <g>
            <path d="M110 176 C100 96 146 52 200 52 C254 52 302 96 290 176 C286 146 272 118 246 106 C228 100 212 100 200 108 C188 100 172 100 154 106 C128 118 114 146 110 176 Z" fill={hairColor} />
            <path d="M150 100 C166 84 184 78 200 78 C218 78 236 84 252 100" stroke={hL} strokeWidth="5" fill="none" strokeLinecap="round" opacity=".45" />
            <path d="M176 70 Q200 58 224 70" stroke={hD} strokeWidth="5" fill="none" strokeLinecap="round" />
          </g>
        );
      default:
        return <path d="M122 120 C130 84 164 68 200 68 C236 68 270 84 278 120 C262 98 232 88 200 88 C168 88 138 98 122 120 Z" fill={skinD} opacity=".22" />;
    }
  };

  const glasses = () => {
    if (accessory === "none") return null;
    const frame = "#1f2633";
    return (
      <g fill="none" stroke={frame} strokeWidth="4" strokeLinecap="round">
        {accessory === "glasses-round" ? (
          <>
            <circle cx="158" cy="174" r="31" fill="#ffffff" fillOpacity=".07" />
            <circle cx="242" cy="174" r="31" fill="#ffffff" fillOpacity=".07" />
          </>
        ) : (
          <>
            <rect x="126" y="152" width="64" height="46" rx="12" fill="#ffffff" fillOpacity=".07" />
            <rect x="210" y="152" width="64" height="46" rx="12" fill="#ffffff" fillOpacity=".07" />
          </>
        )}
        <path d="M189 172 Q200 164 211 172" />
        <path d="M127 170 L112 164" />
        <path d="M273 170 L288 164" />
        <path d="M140 160 Q148 155 156 157" stroke="#fff" strokeWidth="2.5" opacity=".55" />
      </g>
    );
  };

  // ---- boca ---------------------------------------------------------------------------------------------------------------
  const mouth = () => {
    const smile = thinking ? 0 : 1;
    const corner = 238 - smile * 1.5;
    const upper = `M172 ${corner} Q186 ${229 - o * 0.12} 200 ${232.5 - o * 0.16} Q214 ${229 - o * 0.12} 228 ${corner} Q214 ${237 - o * 0.1} 200 ${237.5 - o * 0.1} Q186 ${237 - o * 0.1} 172 ${corner} Z`;
    const lower = `M174 ${corner + 1} Q200 ${244 + o * 0.9} 226 ${corner + 1} Q214 ${253 + o} 200 ${254 + o} Q186 ${253 + o} 174 ${corner + 1} Z`;
    const inner = `M174 ${corner + 0.5} Q200 ${237 - o * 0.1} 226 ${corner + 0.5} Q216 ${242 + o} 200 ${243 + o} Q184 ${242 + o} 174 ${corner + 0.5} Z`;
    const open = o > 1.2;
    return (
      <g>
        {open && (
          <>
            <clipPath id={`m${uid}`}><path d={inner} /></clipPath>
            <path d={inner} fill="#4f1621" />
            <g clipPath={`url(#m${uid})`}>
              {o > 4 && <path d={`M176 237 Q200 ${234 - o * 0.1} 224 237 L224 ${237 + Math.min(8, o * 0.5)} Q200 ${239 + Math.min(8, o * 0.5)} 176 ${237 + Math.min(8, o * 0.5)} Z`} fill="#fbfaf8" />}
              <ellipse cx="200" cy={244 + o * 0.9} rx={12 + o * 0.15} ry={Math.max(2, o * 0.3)} fill="#c4606c" />
            </g>
          </>
        )}
        <path d={lower} fill={lip} />
        <path d={`M184 ${246 + o} Q200 ${250 + o} 216 ${246 + o}`} stroke={lipL} strokeWidth="2.2" fill="none" strokeLinecap="round" opacity=".55" />
        <path d={upper} fill={darken(lip, 0.1)} />
        {!open && <path d={`M174 ${corner + 0.5} Q200 ${239.5} 226 ${corner + 0.5}`} stroke={darken(lip, 0.45)} strokeWidth="1.6" fill="none" strokeLinecap="round" />}
        {smile > 0 && o < 6 && (
          <>
            <path d="M168 236 Q165 241 170 244" stroke={skinDD} strokeWidth="2" fill="none" opacity=".35" strokeLinecap="round" />
            <path d="M232 236 Q235 241 230 244" stroke={skinDD} strokeWidth="2" fill="none" opacity=".35" strokeLinecap="round" />
          </>
        )}
      </g>
    );
  };

  // Enquadramento responsivo: o rosto fica no terço superior/central de telas altas (celular) e centrado em telas largas.
  const box = useRef<HTMLDivElement>(null);
  const [vbAuto, setVbAuto] = useState("0 0 400 400");
  useEffect(() => {
    const el = box.current;
    if (!el || framing === "face") return;
    const fit = () => {
      const a = el.clientWidth / Math.max(1, el.clientHeight);
      let w: number, h: number, y: number;
      if (a >= 340 / 380) {
        h = 380;
        w = h * a;
        y = 24;
      } else {
        w = 340;
        h = w / a;
        y = 215 - h * 0.4;
      }
      setVbAuto(`${200 - w / 2} ${y} ${w} ${h}`);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [framing]);
  const facePath = masc
    ? "M200 72 C146 72 114 112 114 168 C114 212 124 244 148 262 Q172 276 200 276 Q228 276 252 262 C276 244 286 212 286 168 C286 112 254 72 200 72 Z"
    : "M200 72 C146 72 114 112 114 168 C114 220 140 264 200 270 C260 264 286 220 286 168 C286 112 254 72 200 72 Z";
  const facialColor = hair === "hair-none" ? darken(hairColor, 0.1) : darken(hairColor, 0.05);
  const vb = framing === "face" ? "90 56 220 220" : vbAuto;

  return (
    <div ref={box} className={className} style={{ background: bare ? undefined : avatarBackground(accent), position: "relative", overflow: "hidden" }}>
      <svg viewBox={vb} role="img" aria-label="Rosto do agente" preserveAspectRatio="xMidYMid meet" style={{ width: "100%", height: "100%", display: "block" }}>
        <defs>
          <linearGradient id={`face${uid}`} x1="0" x2="1" y1="0" y2="0">
            <stop offset="0" stopColor={skinD} stopOpacity=".38" />
            <stop offset=".22" stopColor={skinD} stopOpacity="0" />
            <stop offset=".78" stopColor={skinD} stopOpacity="0" />
            <stop offset="1" stopColor={skinD} stopOpacity=".5" />
          </linearGradient>
          <linearGradient id={`shirt${uid}`} x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor={shirtL} />
            <stop offset="1" stopColor={darken(shirt, 0.25)} />
          </linearGradient>
          <filter id={`blur${uid}`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6" /></filter>
        </defs>

        {!bare && (
          <>
            <circle cx="70" cy="70" r="120" fill="#fff" opacity=".07" />
            <circle cx="350" cy="360" r="140" fill="#000" opacity=".08" />
          </>
        )}

        {hairBack()}

        <g className="av-body">
          {/* ombros e camiseta */}
          <path d={masc ? "M8 760 L8 404 C14 338 76 304 156 294 Q200 318 244 294 C324 304 386 338 392 404 L392 760 Z" : "M28 760 L28 404 C34 338 90 306 158 296 Q200 318 242 296 C310 306 366 338 372 404 L372 760 Z"} fill={`url(#shirt${uid})`} />
          <path d="M158 296 Q200 326 242 296" stroke={lighten(shirt, 0.25)} strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M70 330 Q60 366 56 404" stroke={darken(shirt, 0.3)} strokeWidth="3" fill="none" opacity=".35" />
          {/* pescoço */}
          <path d={masc ? "M162 232 L162 294 Q200 324 238 294 L238 232 Z" : "M168 232 L168 292 Q200 322 232 292 L232 232 Z"} fill={skin} />
          <path d={masc ? "M162 250 Q200 288 238 250 L238 270 Q200 306 162 270 Z" : "M168 248 Q200 284 232 248 L232 268 Q200 302 168 268 Z"} fill={skinDD} opacity=".38" />
          <path d="M158 296 Q200 330 242 296 Q200 312 158 296 Z" fill={skin} />

          <g className={talking ? "av-head av-sway" : "av-head"}>
            {/* orelhas */}
            <ellipse cx="114" cy="178" rx={masc ? 12 : 11} ry={masc ? 21 : 19} fill={skinD} />
            <ellipse cx="286" cy="178" rx={masc ? 12 : 11} ry={masc ? 21 : 19} fill={skinD} />
            <ellipse cx="114" cy="180" rx="5" ry="11" fill={skinDD} opacity=".35" />
            <ellipse cx="286" cy="180" rx="5" ry="11" fill={skinDD} opacity=".35" />
            {/* rosto */}
            <path d={facePath} fill={skin} />
            <path d={facePath} fill={`url(#face${uid})`} />
            <ellipse cx="200" cy="120" rx="46" ry="30" fill={skinL} opacity=".28" filter={`url(#blur${uid})`} />
            {/* bochechas */}
            <ellipse cx="140" cy="216" rx="22" ry="13" fill="#e8757d" opacity={masc ? 0.14 : 0.3} filter={`url(#blur${uid})`} />
            <ellipse cx="260" cy="216" rx="22" ry="13" fill="#e8757d" opacity={masc ? 0.14 : 0.3} filter={`url(#blur${uid})`} />
            {/* olhos e sobrancelhas */}
            {eye(158, 1)}
            {eye(242, -1)}
            <g style={{ transform: thinking ? "translateY(-5px)" : talking ? `translateY(${-lvl * 2}px)` : "none", transition: "transform .25s ease" }} stroke={browC} strokeWidth={masc ? 9 : 6.5} fill="none" strokeLinecap="round">
              <path d={thinking ? "M128 150 Q150 132 184 140" : masc ? "M128 150 Q154 140 184 146" : "M128 152 Q152 134 184 144"} />
              <path d={thinking ? "M216 140 Q250 132 272 150" : masc ? "M216 146 Q246 140 272 150" : "M216 144 Q248 134 272 152"} />
            </g>
            {/* nariz */}
            <ellipse cx="198" cy="194" rx="5" ry="20" fill={skinL} opacity=".2" />
            <path d="M207 192 Q215 212 205 221" stroke={skinDD} strokeWidth="3" fill="none" strokeLinecap="round" opacity=".32" />
            <path d="M189 223 Q200 231 211 223" stroke={skinDD} strokeWidth="3.4" fill="none" strokeLinecap="round" opacity=".6" />
            <ellipse cx="192" cy="224" rx="3" ry="1.7" fill={skinDD} opacity=".5" />
            <ellipse cx="208" cy="224" rx="3" ry="1.7" fill={skinDD} opacity=".5" />
            {facial === "stubble" && <path d="M118 184 C120 236 148 268 200 274 C252 268 280 236 282 184 C270 214 242 238 200 240 C158 238 130 214 118 184 Z" fill={facialColor} opacity=".3" />}
            {facial === "beard" && <path d="M114 180 C108 236 142 282 200 288 C258 282 292 236 286 180 C278 206 262 222 244 228 C232 220 216 220 200 226 C184 220 168 220 156 228 C138 222 122 206 114 180 Z" fill={facialColor} />}
            {(facial === "mustache" || facial === "goatee" || facial === "beard") && <path d="M164 228 C174 214 192 216 200 222 C208 216 226 214 236 228 C226 234 210 231 200 229 C190 231 174 234 164 228 Z" fill={facialColor} />}
            {facial === "goatee" && <path d="M176 250 C182 274 218 274 224 250 C214 260 186 260 176 250 Z" fill={facialColor} />}
            <g transform={masc ? "translate(0 33.6) scale(1 0.86)" : undefined}>{mouth()}</g>
            {/* sombra suave sob o lábio e queixo */}
            <ellipse cx="200" cy="262" rx="22" ry="5" fill={skinDD} opacity=".14" />
            {hairFront()}
            {glasses()}
          </g>
        </g>
      </svg>
    </div>
  );
}

/** Miniatura (rosto enquadrado). */
export function AvatarThumb({ avatar, className }: { avatar: AvatarT; className?: string; size?: number }) {
  return <Avatar avatar={avatar} framing="face" className={className} />;
}
