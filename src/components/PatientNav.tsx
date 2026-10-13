"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "./ui";
import { ThemeControls, type FontSize, type Theme } from "./ThemeControls";

const items = [
  { href: "/app", label: "Início", exact: true },
  { href: "/app/atendimento", label: "Atendimento" },
  { href: "/app/sessoes", label: "Sessões" },
  { href: "/app/agente", label: "Meu agente" },
];

export function PatientNav({ name, theme, size }: { name: string; theme: Theme; size: FontSize }) {
  const path = usePathname();
  const router = useRouter();
  const active = (i: (typeof items)[number]) => (i.exact ? path === i.href : path.startsWith(i.href));
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }
  return (
    <header className="border-b border-line bg-sand/80 backdrop-blur sticky top-0 z-20">
      <div className="max-w-5xl mx-auto px-5 h-16 flex items-center justify-between gap-4">
        <Logo href="/app" />
        <nav className="hidden md:flex items-center gap-1" aria-label="Principal">
          {items.map((i) => (
            <Link key={i.href} href={i.href} aria-current={active(i) ? "page" : undefined} className={`px-4 py-2 rounded-full text-sm font-semibold ${active(i) ? "bg-active text-white" : "text-ink-soft hover:bg-sand-deep"}`}>{i.label}</Link>
          ))}
        </nav>
        <div className="flex items-center gap-3 text-sm">
          <ThemeControls theme={theme} size={size} />
          <span className="hidden sm:inline text-muted">{name.split(" ")[0]}</span>
          <button onClick={logout} className="text-muted hover:text-ink underline underline-offset-4">Sair</button>
        </div>
      </div>
      <nav className="md:hidden flex border-t border-line" aria-label="Principal (celular)">
        {items.map((i) => (
          <Link key={i.href} href={i.href} aria-current={active(i) ? "page" : undefined} className={`flex-1 text-center py-2.5 text-xs font-semibold ${active(i) ? "text-teal-deep border-b-2 border-teal" : "text-muted"}`}>{i.label}</Link>
        ))}
      </nav>
    </header>
  );
}
