import { PageTitle, Badge } from "@/components/ui";
import { CopyButton, InviteForm, RevokeInvite } from "@/components/AdminWidgets";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fmtDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function Invites() {
  await requireAdmin();
  const rows = await prisma.invite.findMany({ orderBy: { id: "desc" }, include: { used_by: { select: { id: true, name: true } } } });
  const now = new Date();
  const appUrl = (process.env.APP_URL ?? "").replace(/\/$/, "");
  return (
    <>
      <PageTitle title="Convites" sub="Cada código funciona uma única vez. Gere, envie o link e acompanhe quem entrou." />
      <div className="space-y-6">
        <InviteForm appUrl={appUrl} />
        <div className="card !p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted border-b border-line"><th className="p-3">Código</th><th className="p-3">Anotação</th><th className="p-3">Status</th><th className="p-3">Usado por</th><th className="p-3">Criado</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => {
                const expired = !r.used_by_id && r.expires_at && r.expires_at < now;
                const usable = !r.used_by_id && !r.revoked && !expired;
                return (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="p-3 font-mono tracking-wider">{r.code}</td>
                    <td className="p-3">{r.label ?? "—"}</td>
                    <td className="p-3">{r.used_by_id ? <Badge tone="good">usado</Badge> : r.revoked ? <Badge tone="alert">revogado</Badge> : expired ? <Badge tone="warn">expirado</Badge> : <Badge>disponível</Badge>}</td>
                    <td className="p-3">{r.used_by?.name ?? "—"}{r.used_at && <span className="block text-xs text-muted">{fmtDateTime(r.used_at)}</span>}</td>
                    <td className="p-3 text-muted">{fmtDateTime(r.created_at)}</td>
                    <td className="p-3 text-right space-x-3 whitespace-nowrap">{usable && <><CopyButton text={`${appUrl}/cadastro?code=${r.code}`} label="Copiar link" /><CopyButton text={r.code} /><RevokeInvite id={r.id} /></>}</td>
                  </tr>
                );
              })}
              {!rows.length && <tr><td className="p-6 text-muted" colSpan={6}>Nenhum convite ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
