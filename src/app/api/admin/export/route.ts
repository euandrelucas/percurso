import { apiUser } from "@/lib/auth";
import { bad, rateLimit } from "@/lib/api";
import { audit, prisma } from "@/lib/prisma";
import { parseAnalysis, getSession } from "@/lib/store";

const esc = (v: unknown) => {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // evita injeção de fórmula ao abrir no Excel/Sheets
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** CSV de dados do estudo, PSEUDONIMIZADO: sem nome, e-mail ou conteúdo de conversa — só o nº do participante e métricas. */
export async function GET() {
  const admin = await apiUser("admin");
  if (!admin) return bad("Não autorizado", 403);
  if (!rateLimit(`export:${admin.id}`, 10, 10 * 60_000)) return bad("Muitos downloads em sequência.", 429);
  const rows = await prisma.therapySession.findMany({ where: { user: { role: "patient" } }, orderBy: [{ user_id: "asc" }, { number: "asc" }] });
  const scr = await prisma.screening.findMany({ where: { kind: { in: ["phq2", "gad2"] } } });
  const head = ["participante", "sessao", "tipo", "inicio_utc", "duracao_min", "encerramento", "humor_inicio", "humor_fim", "risco_nivel", "phq2", "gad2", "avaliacao_1a3", "prompt_version"];
  const lines = [head.join(",")];
  for (const r of rows) {
    const s = await getSession(r.id);
    const a = parseAnalysis(s);
    const phq = scr.find((x) => x.user_id === r.user_id && x.kind === "phq2")?.score;
    const gad = scr.find((x) => x.user_id === r.user_id && x.kind === "gad2")?.score;
    lines.push([r.user_id, r.number, r.kind, r.started_at.toISOString(), r.duration_sec ? Math.round(r.duration_sec / 60) : "", r.end_reason, r.mood_start, r.mood_end, a?.risco.nivel ?? "", phq, gad, r.feedback_rating ?? "", r.prompt_version].map(esc).join(","));
  }
  await audit(`admin:${admin.id}`, "export.csv", null, { rows: rows.length });
  return new Response("﻿" + lines.join("\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="percurso-estudo-pseudonimizado.csv"', "Cache-Control": "no-store" } });
}
