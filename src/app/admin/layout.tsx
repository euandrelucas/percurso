import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "@/components/AdminNav";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAdmin({ skip2fa: true }); // a página /admin/seguranca precisa abrir mesmo sem 2FA
  // A exigência de 2FA é aplicada por página (requireAdmin) — o layout não é reexecutado em navegação client-side.
  const open = await prisma.alert.count({ where: { status: "aberto" } });
  return (
    <div className="md:flex">
      <AdminNav openAlerts={open} />
      <main className="flex-1 min-w-0 p-5 md:p-10 max-w-6xl">
        {!me.totp_enabled && (
          <div className="mb-6 rounded-xl bg-coral-soft border border-[#f1c4b8] px-4 py-3 text-sm text-ink-soft">
            <strong className="text-ink">Ative a verificação em duas etapas.</strong> Esta conta acessa dados de saúde sensíveis. <a href="/admin/seguranca" className="font-semibold text-[#b4401f] underline">Configurar agora</a>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
