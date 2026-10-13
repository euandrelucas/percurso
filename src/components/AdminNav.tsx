"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Logo } from "./ui";

export function AdminNav({ openAlerts }: { openAlerts: number }) {
  const path = usePathname();
  const router = useRouter();
  const items = [
    { href: "/admin", label: "Painel", exact: true },
    { href: "/admin/alertas", label: "Alertas", badge: openAlerts },
    { href: "/admin/pacientes", label: "Pacientes" },
    { href: "/admin/convites", label: "Convites" },
    { href: "/admin/conhecimento", label: "Conhecimento" },
    { href: "/admin/auditoria", label: "Auditoria" },
    { href: "/admin/seguranca", label: "Segurança" },
  ];
  return (
    <aside className="md:w-56 shrink-0 md:min-h-dvh bg-night text-white p-4 md:p-5 flex md:flex-col gap-3 md:gap-8 items-center md:items-stretch justify-between md:sticky md:top-0 md:h-dvh">
      <Logo light href="/admin" />
      <nav className="flex md:flex-col gap-1 flex-1 md:flex-none overflow-x-auto" aria-label="Admin">
        {items.map((i) => {
          const on = i.exact ? path === i.href : path.startsWith(i.href);
          return (
            <Link key={i.href} href={i.href} aria-current={on ? "page" : undefined} className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm font-semibold whitespace-nowrap ${on ? "bg-white/15" : "text-white/70 hover:bg-white/10"}`}>
              {i.label}
              {!!i.badge && <span className="ml-2 rounded-full bg-coral text-white text-[11px] px-2 py-0.5">{i.badge}</span>}
            </Link>
          );
        })}
      </nav>
      <button className="text-sm text-white/60 hover:text-white md:mt-auto text-left" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push("/entrar"); router.refresh(); }}>Sair</button>
    </aside>
  );
}
