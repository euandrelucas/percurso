import { PageTitle, Badge } from "@/components/ui";
import { CopyButton, InviteForm, RevokeInvite } from "@/components/AdminWidgets";
import { all } from "@/lib/db";
import { fmtDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";

export default function Invites() {
  const rows = all<{ id: number; code: string; label: string | null; used_by: number | null; used_at: string | null; revoked: number; expires_at: string | null; created_at: string; user_name: string | null }>(
    "SELECT i.*, u.name AS user_name FROM invites i LEFT JOIN users u ON u.id = i.used_by ORDER BY i.id DESC",
  );
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  return (
    <>
      <PageTitle title="Convites" sub="Cada código funciona uma única vez. Gere, envie e acompanhe quem entrou." />
      <div className="space-y-6">
        <InviteForm />
        <div className="card !p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-muted border-b border-line"><th className="p-3">Código</th><th className="p-3">Anotação</th><th className="p-3">Status</th><th className="p-3">Usado por</th><th className="p-3">Criado</th><th /></tr></thead>
            <tbody>
              {rows.map((r) => {
                const expired = !r.used_by && r.expires_at && r.expires_at < now;
                return (
                  <tr key={r.id} className="border-b border-line last:border-0">
                    <td className="p-3 font-mono tracking-wider">{r.code}</td>
                    <td className="p-3">{r.label ?? "—"}</td>
                    <td className="p-3">{r.used_by ? <Badge tone="good">usado</Badge> : r.revoked ? <Badge tone="alert">revogado</Badge> : expired ? <Badge tone="warn">expirado</Badge> : <Badge>disponível</Badge>}</td>
                    <td className="p-3">{r.user_name ?? "—"}{r.used_at && <span className="block text-xs text-muted">{fmtDateTime(r.used_at)}</span>}</td>
                    <td className="p-3 text-muted">{fmtDateTime(r.created_at)}</td>
                    <td className="p-3 text-right space-x-3">{!r.used_by && !r.revoked && !expired && <><CopyButton text={r.code} /><RevokeInvite id={r.id} /></>}</td>
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
