import { PageTitle } from "@/components/ui";
import { PasswordForm, TwoFactorSetup } from "@/components/SecurityForms";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fmtDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Segurança" };

export default async function Security() {
  const me = await requireAdmin({ skip2fa: true });
  const sessions = await prisma.authSession.findMany({ where: { user_id: me.id, pending_2fa: false, expires_at: { gt: new Date() } }, orderBy: { last_seen_at: "desc" } });
  return (
    <>
      <PageTitle title="Segurança da conta" sub="Esta conta acessa dados de saúde sensíveis. Proteja-a." />
      <div className="space-y-6 max-w-3xl">
        <section className="card"><h2 className="text-xl font-semibold mb-3">Verificação em duas etapas (2FA)</h2><TwoFactorSetup enabled={me.totp_enabled} /></section>
        <section className="card"><h2 className="text-xl font-semibold mb-3">Trocar senha</h2><PasswordForm /><p className="hint mt-3">Mínimo de 10 caracteres. Ao trocar, todos os outros dispositivos são desconectados.</p></section>
        <section className="card">
          <h2 className="text-xl font-semibold mb-3">Sessões ativas</h2>
          <ul className="text-sm divide-y divide-line">{sessions.map((s) => <li key={s.id} className="py-2 flex flex-wrap gap-x-4"><span>{fmtDateTime(s.last_seen_at)}</span><span className="text-muted truncate max-w-md">{s.user_agent ?? "—"}</span></li>)}</ul>
        </section>
      </div>
    </>
  );
}
