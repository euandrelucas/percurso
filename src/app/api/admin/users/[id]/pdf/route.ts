import { apiUser } from "@/lib/auth";
import { bad, rateLimit } from "@/lib/api";
import { audit, prisma } from "@/lib/prisma";
import { buildDossier } from "@/lib/report-data";
import { renderReportPdf } from "@/lib/report-pdf";
import { getReport } from "@/lib/store";
import type { ReportData } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await apiUser("admin");
  if (!admin) return bad("Não autorizado", 403);
  if (!rateLimit(`pdf:${admin.id}`, 20, 10 * 60_000)) return bad("Muitos downloads em sequência.", 429);
  const id = Number((await ctx.params).id);
  const url = new URL(req.url);
  const reportId = Number(url.searchParams.get("report")) || null;
  const transcripts = url.searchParams.get("transcripts") !== "0";
  const user = Number.isInteger(id) ? await prisma.user.findFirst({ where: { id, role: "patient" }, select: { id: true, name: true } }) : null;
  if (!user) return bad("Paciente não encontrado", 404);
  const report = await getReport<ReportData>(user.id, reportId);
  if (!report) return bad("Nenhum relatório gerado ainda.", 404);

  const pdf = await renderReportPdf(report.data, await buildDossier(user.id), { includeTranscripts: transcripts });
  await audit(`admin:${admin.id}`, "report.pdf.downloaded", user.id, { reportId: report.id, transcripts });
  const safe = user.name.normalize("NFD").replace(/[^\w]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "paciente";
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="percurso-dossie-${user.id}-${safe}.pdf"`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
