import PDFDocument from "pdfkit";
import type { ReportData } from "./types";

const INK = "#0f1829";
const TEAL = "#0d7f74";
const MUTED = "#5b6472";

type Extra = {
  patientName: string;
  email: string;
  sessions: { number: number; kind: string; date: string; duration: string; resumo: string; humorFim: number | null; risco: number }[];
  moods: { score: number; date: string }[];
  scales: { name: string; score: number; flagged: boolean; date: string }[];
};

/** Gera o PDF do relatório (fonte Helvetica embutida: cobre acentos do português). */
export function renderReportPdf(r: ReportData, x: Extra): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margins: { top: 64, bottom: 64, left: 56, right: 56 }, bufferPages: true, info: { Title: r.titulo, Author: "Percurso" } });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width - 112;

    // Capa-cabeçalho
    doc.rect(0, 0, doc.page.width, 120).fill(INK);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(22).text("Percurso", 56, 38);
    doc.font("Helvetica").fontSize(11).fillColor("#9fd8d1").text("Relatório de acompanhamento — confidencial", 56, 68);
    doc.fillColor("#ffffff").fontSize(9).text(`Gerado em ${new Date(r.gerado_em).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`, 56, 88);
    doc.fillColor(INK);
    doc.y = 144;

    doc.font("Helvetica-Bold").fontSize(16).text(r.titulo, 56, doc.y, { width: W });
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(9.5).fillColor(MUTED).text(`${x.patientName} · ${x.email}`);
    doc.moveDown(0.8);

    const heading = (t: string) => {
      if (doc.y > doc.page.height - 140) doc.addPage();
      doc.moveDown(0.6);
      doc.font("Helvetica-Bold").fontSize(12).fillColor(TEAL).text(t.toUpperCase(), { characterSpacing: 0.4 });
      const y = doc.y + 2;
      doc.moveTo(56, y).lineTo(56 + W, y).lineWidth(0.8).strokeColor("#cfe7e4").stroke();
      doc.moveDown(0.5);
      doc.fillColor(INK).font("Helvetica").fontSize(10.5);
    };
    const para = (t: string) => doc.font("Helvetica").fontSize(10.5).fillColor(INK).text(t || "Sem dados suficientes.", { width: W, lineGap: 2.5, align: "left" });
    const bullets = (items: string[]) => {
      if (!items.length) return para("Nenhum item registrado.");
      for (const i of items) doc.font("Helvetica").fontSize(10.5).fillColor(INK).text(`•  ${i}`, { width: W, indent: 0, lineGap: 2, paragraphGap: 3 });
    };

    // Alerta de risco em destaque
    if (/\b(n[ií]vel [23]|risco alto|ideação|plano)\b/i.test(r.riscos_e_alertas)) {
      const h = doc.heightOfString(r.riscos_e_alertas, { width: W - 24 }) + 34;
      const y = doc.y;
      doc.roundedRect(56, y, W, h, 6).fill("#fdecec");
      doc.fillColor("#b42318").font("Helvetica-Bold").fontSize(10).text("ATENÇÃO — sinais de risco registrados", 68, y + 10);
      doc.fillColor(INK).font("Helvetica").fontSize(10).text(r.riscos_e_alertas, 68, y + 24, { width: W - 24 });
      doc.y = y + h + 10;
      doc.x = 56;
    }

    heading("Identificação");
    para(r.identificacao);
    heading("Motivo da busca");
    para(r.motivo_da_busca);

    heading("Triagem inicial");
    para(r.triagem);
    if (x.scales.length) {
      doc.moveDown(0.3);
      for (const s of x.scales) doc.font("Helvetica").fontSize(10).fillColor(MUTED).text(`${s.name}: ${s.score}/6${s.flagged ? "  (acima do ponto de atenção)" : ""} — ${s.date}`);
    }

    heading("Evolução");
    para(r.evolucao);
    if (x.moods.length > 1) drawMoodChart(doc, x.moods.map((m) => m.score), W);

    heading("Temas principais");
    bullets(r.temas_principais);

    heading("Fatos observados (o que o paciente relatou)");
    bullets(r.fatos_observados);

    heading("Hipóteses em aberto (a validar por profissional)");
    if (!r.hipoteses.length) para("Nenhuma hipótese registrada.");
    for (const h of r.hipoteses) doc.font("Helvetica").fontSize(10.5).fillColor(INK).text(`•  ${h.texto}  `, { width: W, continued: true, lineGap: 2 }).font("Helvetica-Oblique").fillColor(MUTED).text(`[confiança ${h.confianca}]`, { paragraphGap: 3 });

    heading("Metas e exercícios");
    para(r.metas_e_exercicios);

    heading("Riscos e alertas");
    para(r.riscos_e_alertas);

    heading("Adesão e engajamento");
    para(r.adesao_e_engajamento);

    heading("Recomendações ao profissional");
    bullets(r.recomendacoes_ao_profissional);

    if (x.sessions.length) {
      heading("Linha do tempo das sessões");
      for (const s of x.sessions) {
        if (doc.y > doc.page.height - 130) doc.addPage();
        doc.font("Helvetica-Bold").fontSize(10).fillColor(INK).text(`Sessão ${s.number} · ${s.kind === "triagem" ? "Triagem" : "Acompanhamento"} · ${s.date} · ${s.duration}${s.humorFim != null ? ` · humor final ${s.humorFim}/10` : ""}${s.risco ? ` · risco nível ${s.risco}` : ""}`, { width: W });
        doc.font("Helvetica").fontSize(9.5).fillColor(MUTED).text(s.resumo || "Sem resumo.", { width: W, lineGap: 2, paragraphGap: 6 });
      }
    }

    heading("Limitações");
    doc.font("Helvetica-Oblique").fontSize(9.5).fillColor(MUTED).text(r.limitacoes, { width: W, lineGap: 2 });

    // Rodapé em todas as páginas
    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.font("Helvetica").fontSize(8).fillColor(MUTED);
      doc.text(`Percurso · Documento confidencial · Página ${i + 1} de ${range.count}`, 56, doc.page.height - 40, { width: W, align: "center", lineBreak: false });
    }
    doc.end();
  });
}

function drawMoodChart(doc: PDFKit.PDFDocument, scores: number[], W: number) {
  const h = 70;
  if (doc.y > doc.page.height - 160) doc.addPage();
  const x0 = 56;
  const y0 = doc.y + 8;
  doc.font("Helvetica").fontSize(8).fillColor(MUTED).text("Humor (0–10)", x0, y0 - 6);
  const top = y0 + 8;
  doc.rect(x0, top, W, h).strokeColor("#e3e8ef").lineWidth(0.5).stroke();
  const pts = scores.map((s, i) => [x0 + (scores.length === 1 ? W / 2 : (i / (scores.length - 1)) * W), top + h - (Math.max(0, Math.min(10, s)) / 10) * h] as const);
  doc.lineWidth(1.6).strokeColor(TEAL);
  pts.forEach(([x, y], i) => (i === 0 ? doc.moveTo(x, y) : doc.lineTo(x, y)));
  doc.stroke();
  pts.forEach(([x, y]) => doc.circle(x, y, 2.4).fill(TEAL));
  doc.y = top + h + 10;
  doc.x = 56;
}

export function pdfExtra(args: Extra): Extra {
  return args;
}
