import { apiUser } from "@/lib/auth";
import { bad } from "@/lib/api";
import { get } from "@/lib/db";
import { renderReportPdf } from "@/lib/report-pdf";
import { endedSessions, parseAnalysis, screenings, moodHistory } from "@/lib/store";
import { fmtDate, fmtDuration } from "@/lib/time";
import type { ReportData } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await apiUser("admin");
  if (!admin) return bad("Não autorizado", 403);
  const id = Number((await ctx.params).id);
  const reportId = Number(new URL(req.url).searchParams.get("report")) || null;
  const user = get<{ name: string; email: string }>("SELECT name, email FROM users WHERE id = ? AND role = 'patient'", id);
  if (!user) return bad("Paciente não encontrado", 404);
  const row = reportId
    ? get<{ data: string }>("SELECT data FROM reports WHERE id = ? AND user_id = ?", reportId, id)
    : get<{ data: string }>("SELECT data FROM reports WHERE user_id = ? ORDER BY id DESC LIMIT 1", id);
  if (!row) return bad("Nenhum relatório gerado ainda.", 404);
  const data = JSON.parse(row.data) as ReportData;

  const pdf = await renderReportPdf(data, {
    patientName: user.name,
    email: user.email,
    sessions: endedSessions(id, 50).reverse().map((s) => {
      const a = parseAnalysis(s);
      return { number: s.number, kind: s.kind, date: fmtDate(s.started_at), duration: fmtDuration(s.duration_sec), resumo: a?.resumo ?? "", humorFim: a?.humor_estimado_fim ?? null, risco: a?.risco.nivel ?? 0 };
    }),
    moods: moodHistory(id, 60).map((m) => ({ score: m.score, date: fmtDate(m.created_at) })),
    scales: screenings(id).filter((s) => s.kind !== "seguranca").map((s) => ({ name: s.kind.toUpperCase(), score: s.score, flagged: !!s.flagged, date: fmtDate(s.created_at) })),
  });
  const safe = user.name.normalize("NFD").replace(/[^\w]+/g, "-").replace(/-+/g, "-").toLowerCase();
  return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="percurso-relatorio-${safe}.pdf"`, "Cache-Control": "no-store" } });
}
