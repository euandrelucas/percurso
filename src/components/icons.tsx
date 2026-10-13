import type { SVGProps } from "react";

/** Ícones do app (SVG, traço de 24x24, herdam a cor do texto). Usar no lugar de emojis para ficar igual em qualquer aparelho. */
const P = {
  mic: "M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z M19 10v1a7 7 0 0 1-14 0v-1 M12 18v4 M8 22h8",
  "mic-off": "M2 2l20 20 M9 9v2a3 3 0 0 0 5.12 2.12 M15 9.34V5a3 3 0 0 0-5.94-.6 M17 16.95A7 7 0 0 1 5 11v-1 M19 10v1a7 7 0 0 1-.11 1.23 M12 18v4 M8 22h8",
  video: "M23 7l-7 5 7 5V7z M3 5h11a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z",
  "video-off": "M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2m5.66 0H14a2 2 0 0 1 2 2v3.34l1 1L23 7v10 M1 1l22 22",
  volume: "M11 5L6 9H2v6h4l5 4V5z M15.54 8.46a5 5 0 0 1 0 7.07 M19.07 4.93a10 10 0 0 1 0 14.14",
  heart: "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z",
  bell: "M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 0 1-3.46 0",
  check: "M20 6L9 17l-5-5",
  "check-check": "M18 6L7 17l-5-5 M22 10l-7.5 7.5L13 16",
  help: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3 M12 17h.01",
  target: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12z M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4z",
  // carinhas de humor (1 = muito mal ... 5 = muito bem)
  "face-1": "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M9 11.5h.01 M15 11.5h.01 M7.5 9l2.5-1.2 M16.5 9l-2.5-1.2 M8.5 17c1-2.2 2.2-3 3.5-3s2.5.8 3.5 3",
  "face-2": "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M9 10h.01 M15 10h.01 M9 16c1-1.1 2-1.6 3-1.6s2 .5 3 1.6",
  "face-3": "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M9 10h.01 M15 10h.01 M9 15h6",
  "face-4": "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M9 10h.01 M15 10h.01 M8.5 14c1 1.3 2.2 2 3.5 2s2.5-.7 3.5-2",
  "face-5": "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z M9 9.5h.01 M15 9.5h.01 M8 13.5h8a4 4 0 0 1-8 0z",
} as const;

const FILLED = { play: "M7 4.5v15a1 1 0 0 0 1.5.86l12-7.5a1 1 0 0 0 0-1.72l-12-7.5A1 1 0 0 0 7 4.5z", stop: "M7 6.5A1.5 1.5 0 0 1 8.5 5h7A1.5 1.5 0 0 1 17 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 17.5z" } as const;

export type IconName = keyof typeof P | keyof typeof FILLED;

export function Icon({ name, size = 20, strokeWidth = 1.8, title, className, ...rest }: { name: IconName; size?: number; strokeWidth?: number; title?: string } & Omit<SVGProps<SVGSVGElement>, "name">) {
  const filled = name in FILLED;
  const d = filled ? FILLED[name as keyof typeof FILLED] : P[name as keyof typeof P];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke={filled ? "none" : "currentColor"}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      className={`inline-block shrink-0 ${className ?? ""}`}
      {...rest}
    >
      {title && <title>{title}</title>}
      {d.split(" M").map((seg, i) => <path key={i} d={i === 0 ? seg : `M${seg}`} />)}
    </svg>
  );
}

/** Carinha de humor/avaliação por nota de 1 (muito mal) a 5 (muito bem). */
export const faceIcon = (n: 1 | 2 | 3 | 4 | 5): IconName => `face-${n}` as IconName;
