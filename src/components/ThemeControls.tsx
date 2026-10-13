"use client";
import { useState } from "react";

export type Theme = "auto" | "light" | "dark";
export type FontSize = "normal" | "large";

const setCookie = (k: string, v: string) => {
  document.cookie = `${k}=${v}; path=/; max-age=31536000; samesite=lax`;
};

/** Aparência: tema (automático/claro/escuro) e tamanho do texto. Salvo em cookie (sem dados pessoais) para valer já na próxima tela. */
export function ThemeControls({ theme: t0, size: s0 }: { theme: Theme; size: FontSize }) {
  const [theme, setTheme] = useState<Theme>(t0);
  const [size, setSize] = useState<FontSize>(s0);
  const apply = (th: Theme, sz: FontSize) => {
    document.querySelectorAll<HTMLElement>("[data-pc-shell]").forEach((el) => {
      el.dataset.theme = th;
      el.dataset.fs = sz;
    });
  };
  const pickTheme = (v: Theme) => {
    setTheme(v);
    setCookie("pc_theme", v);
    apply(v, size);
  };
  const pickSize = (v: FontSize) => {
    setSize(v);
    setCookie("pc_fs", v);
    apply(theme, v);
  };
  const Opt = ({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) => (
    <button type="button" aria-pressed={on} onClick={onClick} className="chip !py-1 !text-xs">{children}</button>
  );
  return (
    <details className="relative">
      <summary className="list-none cursor-pointer w-9 h-9 rounded-full border border-line grid place-items-center text-sm font-semibold hover:bg-sand-deep" aria-label="Aparência: tema e tamanho do texto" title="Aparência">Aa</summary>
      <div className="absolute right-0 mt-2 w-64 card !p-4 shadow-lg z-30 space-y-3">
        <div>
          <p className="label !mb-1.5">Tema</p>
          <div className="flex flex-wrap gap-1.5">
            <Opt on={theme === "auto"} onClick={() => pickTheme("auto")}>Automático</Opt>
            <Opt on={theme === "light"} onClick={() => pickTheme("light")}>Claro</Opt>
            <Opt on={theme === "dark"} onClick={() => pickTheme("dark")}>Escuro</Opt>
          </div>
        </div>
        <div>
          <p className="label !mb-1.5">Tamanho do texto</p>
          <div className="flex gap-1.5">
            <Opt on={size === "normal"} onClick={() => pickSize("normal")}>Normal</Opt>
            <Opt on={size === "large"} onClick={() => pickSize("large")}>Grande</Opt>
          </div>
        </div>
      </div>
    </details>
  );
}
