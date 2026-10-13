"use client";
import type { Avatar as AvatarT } from "@/lib/prompts/options";

type Props = {
  avatar: AvatarT;
  /** 0..1 — abertura da boca (nível de áudio) */
  level?: number;
  speaking?: boolean;
  thinking?: boolean;
  className?: string;
  /** sem fundo próprio (o contêiner pinta o fundo) */
  bare?: boolean;
};

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, v + amt));
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

/** Rosto ilustrado: piscar, respiração e boca sincronizada ao nível de áudio. */
export function Avatar({ avatar, level = 0, speaking, thinking, className, bare }: Props) {
  const { skin, hair, hairColor, accessory, accent } = avatar;
  const mouthOpen = Math.min(1, level);
  const my = 3 + mouthOpen * 11;
  const mouth = speaking || mouthOpen > 0.02
    ? `M86 ${126 - my / 4} Q100 ${124 + my} 114 ${126 - my / 4} Q100 ${126 + my * 1.1} 86 ${126 - my / 4}Z`
    : thinking
      ? "M90 128 Q100 127 110 129"
      : "M88 126 Q100 134 112 126";
  const dark = shade(skin, -38);
  const blush = shade(skin, -14);
  const gid = `g${accent.slice(1)}`;
  return (
    <svg viewBox="0 0 200 200" className={className} role="img" aria-label="Rosto do agente">
      <defs>
        <radialGradient id={gid} cx="50%" cy="35%" r="80%">
          <stop offset="0%" stopColor={shade(accent, 70)} />
          <stop offset="100%" stopColor={shade(accent, -30)} />
        </radialGradient>
      </defs>
      {!bare && (
        <>
          <rect width="200" height="200" fill={`url(#${gid})`} />
          <circle cx="40" cy="30" r="60" fill="#fff" opacity=".07" />
          <circle cx="170" cy="180" r="70" fill="#000" opacity=".07" />
        </>
      )}
      <g className="av-body">
        {hair === "hair-long" && <path d="M46 98 C38 30 162 30 154 98 L160 190 L40 190Z" fill={hairColor} />}
        {/* ombros */}
        <path d="M24 200 C28 168 62 156 100 156 C138 156 172 168 176 200Z" fill={shade(accent, -55)} />
        <path d="M84 158 L100 176 L116 158Z" fill="#fff" opacity=".85" />
        {/* pescoço */}
        <rect x="86" y="130" width="28" height="32" rx="12" fill={dark} />
        <g className={`av-head ${speaking ? "speaking" : ""}`}>
          {/* orelhas */}
          <ellipse cx="55" cy="96" rx="7" ry="11" fill={dark} />
          <ellipse cx="145" cy="96" rx="7" ry="11" fill={dark} />
          {/* cabeça */}
          <ellipse cx="100" cy="92" rx="45" ry="52" fill={skin} />
          {/* cabelo (frente) */}
          {hair === "hair-short" && <path d="M54 92 C48 42 82 34 100 34 C126 34 154 46 146 92 C142 72 124 62 100 62 C76 62 60 74 54 92Z" fill={hairColor} />}
          {hair === "hair-long" && <path d="M54 94 C46 40 82 32 100 32 C128 32 154 44 146 94 C138 66 118 58 100 58 C80 58 64 68 54 94Z" fill={hairColor} />}
          {hair === "hair-bun" && (
            <>
              <circle cx="100" cy="26" r="17" fill={hairColor} />
              <path d="M54 92 C48 42 82 36 100 36 C126 36 154 46 146 92 C142 72 124 62 100 62 C76 62 60 74 54 92Z" fill={hairColor} />
            </>
          )}
          {hair === "hair-curly" && (
            <g fill={hairColor}>
              {[[58, 70, 17], [74, 50, 18], [100, 42, 19], [126, 50, 18], [142, 70, 17], [52, 92, 12], [148, 92, 12], [88, 54, 16], [112, 54, 16]].map(([x, y, r], i) => (
                <circle key={i} cx={x} cy={y} r={r} />
              ))}
            </g>
          )}
          {/* sobrancelhas */}
          <path d={thinking ? "M72 70 Q82 64 92 69" : "M72 72 Q82 67 92 71"} stroke={hair === "hair-none" ? dark : hairColor} strokeWidth="3.2" fill="none" strokeLinecap="round" />
          <path d={thinking ? "M108 69 Q118 62 128 68" : "M108 71 Q118 67 128 72"} stroke={hair === "hair-none" ? dark : hairColor} strokeWidth="3.2" fill="none" strokeLinecap="round" />
          {/* olhos */}
          <g>
            <ellipse className="av-eye" cx="82" cy="88" rx="5.2" ry="6.2" fill="#1b1b1f" />
            <ellipse className="av-eye b2" cx="118" cy="88" rx="5.2" ry="6.2" fill="#1b1b1f" />
            <circle cx="84" cy="86" r="1.6" fill="#fff" />
            <circle cx="120" cy="86" r="1.6" fill="#fff" />
          </g>
          {/* nariz e bochechas */}
          <path d="M100 96 Q96 108 101 110" stroke={dark} strokeWidth="2.2" fill="none" strokeLinecap="round" opacity=".7" />
          <ellipse cx="72" cy="110" rx="9" ry="5.5" fill={blush} opacity=".45" />
          <ellipse cx="128" cy="110" rx="9" ry="5.5" fill={blush} opacity=".45" />
          {/* boca */}
          <path d={mouth} fill={speaking || mouthOpen > 0.02 ? "#7a2430" : "none"} stroke="#7a2430" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {/* óculos */}
          {accessory === "glasses-round" && (
            <g fill="none" stroke="#1f2937" strokeWidth="2.6">
              <circle cx="82" cy="88" r="14" />
              <circle cx="118" cy="88" r="14" />
              <path d="M96 88 L104 88" />
              <path d="M68 86 L58 84" />
              <path d="M132 86 L142 84" />
            </g>
          )}
          {accessory === "glasses-square" && (
            <g fill="none" stroke="#1f2937" strokeWidth="2.8">
              <rect x="66" y="76" width="30" height="23" rx="5" />
              <rect x="104" y="76" width="30" height="23" rx="5" />
              <path d="M96 86 L104 86" />
              <path d="M66 84 L58 82" />
              <path d="M134 84 L142 82" />
            </g>
          )}
        </g>
      </g>
    </svg>
  );
}
