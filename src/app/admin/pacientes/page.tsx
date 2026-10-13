import Link from "next/link";
import { PageTitle, Badge } from "@/components/ui";
import { all } from "@/lib/db";
import { fmtDateTime } from "@/lib/time";

export const dynamic = "force-dynamic";

type Row = { id: number; name: string; email: string; status: string; onboarded: number; created_at: string; sessions: number; last_at: string | null; open_alerts: number; max_alert: number | null; mood: number | null };

export default function Patients() {
  const rows = all<Row>(`
    SELECT u.id, u.name, u.email, u.status, u.onboarded, u.created_at,
      (SELECT COUNT(*) FROM sessions s WHERE s.user_id = u.id AND s.status='ended' AND s.duration_sec >= 180) AS sessions,
      (SELECT MAX(started_at) FROM sessions s WHERE s.user_id = u.id) AS last_at,
      (SELECT COUNT(*) FROM alerts a WHERE a.user_id = u.id AND a.status = 'aberto') AS open_alerts,
      (SELECT MAX(level) FROM alerts a WHERE a.user_id = u.id AND a.status != 'resolvido') AS max_alert,
      (SELECT score FROM moods m WHERE m.user_id = u.id ORDER BY id DESC LIMIT 1) AS mood
    FROM users u WHERE u.role = 'patient' ORDER BY (open_alerts > 0) DESC, u.id DESC`);
  return (
    <>
      <PageTitle title="Pacientes" sub="Acompanhamento individual de cada participante do beta." />
      <div className="card !p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="text-left text-muted border-b border-line"><th className="p-3">Paciente</th><th className="p-3">Status</th><th className="p-3">Sessões</th><th className="p-3">Última atividade</th><th className="p-3">Humor</th><th className="p-3">Alertas</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0 hover:bg-sand/60">
                <td className="p-3"><Link href={`/admin/pacientes/${r.id}`} className="font-semibold hover:underline">{r.name}</Link><span className="block text-xs text-muted">{r.email}</span></td>
                <td className="p-3">{r.status !== "active" ? <Badge tone="alert">suspenso</Badge> : r.onboarded ? <Badge tone="good">ativo</Badge> : <Badge tone="warn">onboarding pendente</Badge>}</td>
                <td className="p-3">{r.sessions}</td>
                <td className="p-3 text-muted">{fmtDateTime(r.last_at)}</td>
                <td className="p-3">{r.mood ?? "—"}</td>
                <td className="p-3">{r.open_alerts ? <Badge tone={(r.max_alert ?? 0) >= 3 ? "alert" : "warn"}>{r.open_alerts} aberto(s)</Badge> : <span className="text-muted">—</span>}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="p-6 text-muted">Nenhum paciente ainda. Gere um convite para começar.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
