import PDFDocument from "pdfkit";
import type { Dossier } from "./report-data";
import type { ReportData } from "./types";

const INK = "#0f1829";
const TEAL = "#0d7f74";
const MUTED = "#5b6472";
const LINE = "#d9dee6";
const RED = "#b42318";
const PAGE_M = 56;

/** Fontes padrão do PDF cobrem Latin-1: remove emojis/símbolos fora dessa faixa para não gerar caracteres quebrados. */
const clean = (s: string | null | undefined) =>
  (s ?? "")
    .replace(/[→⇒]/g, "->")
    .replace(/≥/g, ">=")
    .replace(/≤/g, "<=")
    .replace(/[‐-―]/g, "-")
    .replace(/[^\u0009\u000A -~ -ÿ‘’“”•…]/g, "");

const KIND = (k: string) => (k === "triagem" ? "Triagem (1ª sessão)" : "Acompanhamento");
const END = (r: string | null) => ({ agente: "encerrada pela IA (despedida)", paciente: "encerrada pelo paciente", tempo: "limite de tempo", falha_tecnica: "falha técnica", abandonada: "abandonada/conexão perdida" } as Record<string, string>)[r ?? ""] ?? (r ?? "—");
const LEVEL = (n: number) => (n >= 3 ? "ALTO" : n === 2 ? "MÉDIO" : "BAIXO");

export function renderReportPdf(r: ReportData, d: Dossier, opts: { includeTranscripts?: boolean } = {}): Promise<Buffer> {
  const withTranscripts = opts.includeTranscripts !== false;
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 72, bottom: 64, left: PAGE_M, right: PAGE_M },
      bufferPages: true,
      info: { Title: clean(r.titulo), Author: "Percurso", Subject: "Dossiê de acompanhamento — anexo ao estudo", Keywords: "percurso, estudo, confidencial" },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width - PAGE_M * 2;
    const bottomLimit = () => doc.page.height - doc.page.margins.bottom;
    const ensure = (h: number) => {
      if (doc.y + h > bottomLimit()) doc.addPage();
    };

    // ---------------------------------------------------------------- capa
    doc.rect(0, 0, doc.page.width, doc.page.height).fill(INK);
    doc.rect(PAGE_M, 190, 56, 6).fill("#14b8a6");
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(40).text("Percurso", PAGE_M, 214);
    doc.font("Helvetica").fontSize(18).fillColor("#cfe9e5").text("Dossiê de acompanhamento", PAGE_M, 270);
    doc.fontSize(12).fillColor("#9fb1c7").text("Registro completo do participante para anexo ao estudo", PAGE_M, 298);
    doc.font("Helvetica-Bold").fontSize(26).fillColor("#ffffff").text(clean(d.patient.name), PAGE_M, 380, { width: W });
    doc.font("Helvetica").fontSize(11).fillColor("#9fb1c7").text(`Participante nº ${d.patient.id}  ·  ${clean(d.patient.email)}`, PAGE_M, doc.y + 6);
    const stats: [string, string][] = [
      ["Sessões de voz", String(d.totals.sessions)],
      ["Minutos", String(d.totals.minutes)],
      ["Msgs emergência", String(d.totals.chatMessages)],
      ["Alertas", String(d.totals.alerts)],
    ];
    stats.forEach(([k, v], i) => {
      const x = PAGE_M + i * (W / 4);
      doc.fillColor("#14b8a6").font("Helvetica-Bold").fontSize(26).text(v, x, 500, { width: W / 4 });
      doc.fillColor("#9fb1c7").font("Helvetica").fontSize(9).text(k.toUpperCase(), x, 534, { width: W / 4, characterSpacing: 0.6 });
    });
    doc.fillColor("#9fb1c7").fontSize(9).text(`Gerado em ${d.generatedAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`, PAGE_M, 700, { width: W });
    doc.roundedRect(PAGE_M, 724, W, 62, 6).fill("#1a2540");
    doc.fillColor("#f3c6bd").font("Helvetica-Bold").fontSize(9).text("DOCUMENTO CONFIDENCIAL — DADOS SENSÍVEIS DE SAÚDE (LGPD, art. 5º, II)", PAGE_M + 12, 734, { width: W - 24 });
    doc.fillColor("#c3cde0").font("Helvetica").fontSize(8.5).text("Uso restrito à equipe do estudo, conforme o termo de consentimento. Conteúdo gerado em parte por IA; não constitui avaliação clínica nem diagnóstico e requer revisão por profissional habilitado.", PAGE_M + 12, 748, { width: W - 24 });

    doc.addPage();
    const outline = (title: string, parent?: PDFKit.PDFOutline) => (parent ? parent.addItem(clean(title)) : doc.outline.addItem(clean(title)));

    // ---------------------------------------------------------------- helpers
    const h1 = (n: string, t: string) => {
      ensure(80);
      doc.moveDown(0.8);
      doc.font("Helvetica-Bold").fontSize(15).fillColor(INK).text(`${n}  ${clean(t)}`, PAGE_M, doc.y, { width: W });
      const y = doc.y + 3;
      doc.moveTo(PAGE_M, y).lineTo(PAGE_M + W, y).lineWidth(1.2).strokeColor(TEAL).stroke();
      doc.y = y + 10;
      outline(`${n} ${t}`);
    };
    const h2 = (t: string) => {
      ensure(48);
      doc.moveDown(0.5);
      doc.font("Helvetica-Bold").fontSize(11).fillColor(TEAL).text(clean(t).toUpperCase(), PAGE_M, doc.y, { width: W, characterSpacing: 0.3 });
      doc.moveDown(0.25);
    };
    const para = (t: string, o: { color?: string; size?: number; italic?: boolean } = {}) => {
      doc.font(o.italic ? "Helvetica-Oblique" : "Helvetica").fontSize(o.size ?? 10).fillColor(o.color ?? INK).text(clean(t) || "Sem dados suficientes.", PAGE_M, doc.y, { width: W, lineGap: 2.2, align: "left" });
      doc.moveDown(0.35);
    };
    const bullets = (items: string[], empty = "Nenhum item registrado.") => {
      if (!items.length) return para(empty, { color: MUTED, italic: true });
      for (const i of items) {
        ensure(24);
        doc.font("Helvetica").fontSize(10).fillColor(INK).text(`•  ${clean(i)}`, PAGE_M + 4, doc.y, { width: W - 8, lineGap: 2, paragraphGap: 2.5, indent: 0 });
      }
      doc.moveDown(0.2);
    };
    const kv = (k: string, v: string | null | undefined) => {
      if (!v) return;
      ensure(18);
      doc.font("Helvetica-Bold").fontSize(9.5).fillColor(MUTED).text(clean(k), PAGE_M, doc.y, { continued: true, width: W }).font("Helvetica").fillColor(INK).text(`  ${clean(v)}`, { lineGap: 2 });
      doc.moveDown(0.1);
    };
    const callout = (title: string, body: string, tone: "red" | "teal" | "gray") => {
      const colors = { red: ["#fdecec", RED], teal: ["#e6f6f3", TEAL], gray: ["#f1f3f6", MUTED] }[tone];
      const h = doc.heightOfString(clean(body), { width: W - 28 }) + 38;
      ensure(h + 8);
      const y = doc.y;
      doc.roundedRect(PAGE_M, y, W, h, 6).fill(colors[0]);
      doc.rect(PAGE_M, y, 3.5, h).fill(colors[1]);
      doc.fillColor(colors[1]).font("Helvetica-Bold").fontSize(9.5).text(clean(title), PAGE_M + 14, y + 10, { width: W - 28 });
      doc.fillColor(INK).font("Helvetica").fontSize(9.5).text(clean(body), PAGE_M + 14, y + 25, { width: W - 28, lineGap: 2 });
      doc.y = y + h + 8;
      doc.x = PAGE_M;
    };
    const table = (cols: { h: string; w: number }[], rows: string[][], o: { size?: number } = {}) => {
      const size = o.size ?? 9;
      const total = cols.reduce((a, c) => a + c.w, 0);
      const widths = cols.map((c) => (c.w / total) * W);
      const drawHead = () => {
        const y = doc.y;
        doc.rect(PAGE_M, y, W, 20).fill(INK);
        let x = PAGE_M;
        cols.forEach((c, i) => {
          doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8.5).text(clean(c.h), x + 6, y + 6, { width: widths[i] - 12, lineBreak: false });
          x += widths[i];
        });
        doc.y = y + 20;
      };
      ensure(60);
      drawHead();
      rows.forEach((row, ri) => {
        doc.font("Helvetica").fontSize(size);
        const hs = row.map((c, i) => doc.heightOfString(clean(c) || "—", { width: widths[i] - 12 }));
        const h = Math.max(...hs) + 10;
        if (doc.y + h > bottomLimit()) {
          doc.addPage();
          drawHead();
        }
        const y = doc.y;
        if (ri % 2) doc.rect(PAGE_M, y, W, h).fill("#f6f8fa");
        let x = PAGE_M;
        row.forEach((c, i) => {
          doc.fillColor(INK).font("Helvetica").fontSize(size).text(clean(c) || "—", x + 6, y + 5, { width: widths[i] - 12 });
          x += widths[i];
        });
        doc.moveTo(PAGE_M, y + h).lineTo(PAGE_M + W, y + h).lineWidth(0.4).strokeColor(LINE).stroke();
        doc.y = y + h;
      });
      doc.x = PAGE_M;
      doc.moveDown(0.6);
    };
    const moodChart = (points: { score: number; date: string }[]) => {
      if (points.length < 2) return para("Registros de humor insuficientes para um gráfico (mínimo de 2).", { color: MUTED, italic: true });
      const h = 110;
      ensure(h + 40);
      const top = doc.y + 6;
      const left = PAGE_M + 24;
      const cw = W - 30;
      doc.font("Helvetica").fontSize(7.5).fillColor(MUTED);
      for (const v of [0, 5, 10]) {
        const y = top + h - (v / 10) * h;
        doc.moveTo(left, y).lineTo(left + cw, y).lineWidth(0.4).strokeColor(LINE).stroke();
        doc.fillColor(MUTED).text(String(v), PAGE_M, y - 3, { width: 18, align: "right", lineBreak: false });
      }
      const pts = points.map((p, i) => [left + (i / (points.length - 1)) * cw, top + h - (Math.max(0, Math.min(10, p.score)) / 10) * h] as const);
      doc.lineWidth(1.8).strokeColor(TEAL);
      pts.forEach(([x, y], i) => (i === 0 ? doc.moveTo(x, y) : doc.lineTo(x, y)));
      doc.stroke();
      pts.forEach(([x, y]) => doc.circle(x, y, 2.3).fill(TEAL));
      doc.font("Helvetica").fontSize(7.5).fillColor(MUTED);
      doc.text(points[0].date, left, top + h + 4, { width: 120, lineBreak: false });
      doc.text(points[points.length - 1].date, left + cw - 120, top + h + 4, { width: 120, align: "right", lineBreak: false });
      doc.y = top + h + 18;
      doc.x = PAGE_M;
      para(`${points.length} registros, de ${points[0].date} a ${points[points.length - 1].date}. Notas de 0 (muito mal) a 10 (muito bem).`, { color: MUTED, size: 8.5 });
    };

    // ---------------------------------------------------------------- sumário
    doc.font("Helvetica-Bold").fontSize(20).fillColor(INK).text("Sumário", PAGE_M, 72);
    doc.moveDown(0.6);
    const toc = [
      "1  Identificação e consentimento", "2  Agente escolhido pelo participante", "3  Triagem inicial", "4  Síntese do acompanhamento", "5  Evolução do humor",
      "6  Linha do tempo das sessões", "7  Sessões em detalhe", "8  Metas e exercícios", "9  Alertas de risco e tratamento", "10  Memória do caso", "11  Limitações e uso responsável",
      ...(withTranscripts ? ["Anexo A  Transcrições completas das sessões", "Anexo B  Mensagens de emergência (chat)"] : []),
    ];
    toc.forEach((t) => doc.font("Helvetica").fontSize(11).fillColor(INK).text(t, PAGE_M + 6, doc.y, { width: W }).moveDown(0.35));
    doc.moveDown(1);
    callout("Como ler este documento", "As seções 1 a 11 reúnem a síntese e os registros estruturados. Em todo o documento, FATO (o que o participante disse ou fez, e dados objetivos) é separado de HIPÓTESE (interpretação automática, sempre com grau de confiança e a validar por profissional).", "teal");

    // ---------------------------------------------------------------- 1
    doc.addPage();
    h1("1", "Identificação e consentimento");
    kv("Nome:", d.patient.name);
    kv("E-mail:", d.patient.email);
    kv("Participante nº:", String(d.patient.id));
    kv("Cadastro em:", d.patient.registeredAt);
    kv("Consentimento registrado em:", d.patient.consentAt ?? "NÃO REGISTRADO");
    kv("Convite (anotação do pesquisador):", d.patient.inviteLabel);
    kv("Situação da conta:", d.patient.status === "active" ? "ativa" : "suspensa");
    doc.moveDown(0.4);
    para(r.identificacao);
    h2("Motivo da busca");
    para(r.motivo_da_busca);

    // ---------------------------------------------------------------- 2
    h1("2", "Agente escolhido pelo participante");
    if (d.agent) {
      kv("Nome do agente:", d.agent.name);
      kv("Chamado de:", d.agent.preferredName);
      kv("Voz / tom / estilo:", `${d.agent.voice} / ${d.agent.tone} / ${d.agent.style}`);
      kv("Linguagem / humor / ritmo:", `${d.agent.formality} / ${d.agent.humor} / ${d.agent.pace}`);
      kv("Sobre si (palavras do participante):", d.agent.aboutMe);
      kv("Expectativa declarada:", d.agent.goalHint);
      kv("Assuntos a trabalhar:", d.agent.topics);
      kv("Assuntos a evitar:", d.agent.boundaries);
    } else para("Onboarding não concluído.", { color: MUTED, italic: true });

    // ---------------------------------------------------------------- 3
    h1("3", "Triagem inicial");
    if (d.screenings.length) {
      table(
        [{ h: "Instrumento", w: 2 }, { h: "Resultado", w: 2.2 }, { h: "Respostas", w: 5 }, { h: "Data", w: 2 }],
        d.screenings.map((s) => [
          s.kind === "seguranca" ? "Pergunta de segurança" : s.kind === "phq2" ? "PHQ-2 (humor)" : "GAD-2 (ansiedade)",
          s.kind === "seguranca" ? (s.flagged ? "SIM — alerta gerado" : "Não") : `${s.score}/6${s.flagged ? "  (>= 3: ponto de atenção)" : ""}`,
          s.answers.join("  ·  "),
          s.date,
        ]),
      );
      para("PHQ-2 e GAD-2 são instrumentos de rastreio (não diagnósticos); ponto de corte >= 3. A pontuação é calculada por regras fixas, nunca pela IA.", { color: MUTED, size: 8.5 });
    } else para("Sem dados de triagem.", { color: MUTED, italic: true });
    h2("Leitura da triagem");
    para(r.triagem);

    // ---------------------------------------------------------------- 4
    h1("4", "Síntese do acompanhamento");
    h2("Evolução");
    para(r.evolucao);
    h2("Temas principais");
    bullets(r.temas_principais);
    h2("Fatos observados (o que o participante relatou)");
    bullets(r.fatos_observados);
    h2("Hipóteses em aberto (a validar por profissional)");
    if (!r.hipoteses.length) para("Nenhuma hipótese registrada.", { color: MUTED, italic: true });
    r.hipoteses.forEach((h) => {
      ensure(24);
      doc.font("Helvetica").fontSize(10).fillColor(INK).text(`•  ${clean(h.texto)}  `, PAGE_M + 4, doc.y, { width: W - 8, continued: true, lineGap: 2 }).font("Helvetica-Oblique").fillColor(MUTED).text(`[confiança ${h.confianca}]`, { paragraphGap: 2.5 });
    });
    h2("Adesão e engajamento");
    para(r.adesao_e_engajamento);
    h2("Recomendações ao profissional");
    bullets(r.recomendacoes_ao_profissional);

    // ---------------------------------------------------------------- 5
    h1("5", "Evolução do humor");
    moodChart(d.moods);
    const withMood = d.sessions.filter((s) => s.moodStart != null || s.moodEnd != null);
    if (withMood.length) table([{ h: "Sessão", w: 1.4 }, { h: "Data", w: 3 }, { h: "Humor no início", w: 2 }, { h: "Humor ao final", w: 2 }], withMood.map((s) => [`#${s.number}`, s.started, s.moodStart != null ? `${s.moodStart}/10` : "—", s.moodEnd != null ? `${s.moodEnd}/10` : "—"]));

    // ---------------------------------------------------------------- 6
    h1("6", "Linha do tempo das sessões");
    if (d.sessions.length)
      table(
        [{ h: "#", w: 0.8 }, { h: "Data", w: 2.6 }, { h: "Tipo", w: 2.6 }, { h: "Duração", w: 1.6 }, { h: "Término", w: 3 }, { h: "Risco", w: 1.6 }, { h: "Prompt", w: 1.9 }],
        d.sessions.map((s) => [String(s.number), s.started, KIND(s.kind), s.duration, s.status === "active" ? "em andamento" : END(s.endReason), s.analysis ? (s.analysis.risco.nivel ? LEVEL(s.analysis.risco.nivel) : "—") : "?", s.promptVersion ?? "—"]),
        { size: 8.5 },
      );
    else para("Nenhuma sessão registrada.", { color: MUTED, italic: true });

    // ---------------------------------------------------------------- 7
    h1("7", "Sessões em detalhe");
    if (!d.sessions.length) para("Nenhuma sessão registrada.", { color: MUTED, italic: true });
    for (const s of d.sessions) {
      ensure(110);
      doc.moveDown(0.5);
      const o = outline(`Sessão ${s.number} — ${s.started}`, doc.outline.children[doc.outline.children.length - 1]);
      void o;
      doc.font("Helvetica-Bold").fontSize(12).fillColor(INK).text(`Sessão ${s.number}  ·  ${KIND(s.kind)}`, PAGE_M, doc.y, { width: W });
      doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(`${s.started}  ·  duração ${s.duration}  ·  ${s.status === "active" ? "em andamento" : END(s.endReason)}${s.moodStart != null || s.moodEnd != null ? `  ·  humor ${s.moodStart ?? "—"} a ${s.moodEnd ?? "—"}` : ""}`, { width: W });
      doc.moveDown(0.3);
      const a = s.analysis;
      if (!a) {
        para(s.status === "active" ? "Sessão em andamento." : "Análise automática indisponível — consulte a transcrição (Anexo A).", { color: MUTED, italic: true });
        continue;
      }
      if (a.risco.nivel >= 1) callout(`Sinal de risco — nível ${a.risco.nivel} (${LEVEL(a.risco.nivel)})`, a.risco.evidencias.join("  |  ") || "Sem trecho registrado.", a.risco.nivel >= 2 ? "red" : "gray");
      para(a.resumo);
      if (a.temas.length) kv("Temas:", a.temas.join("; "));
      if (a.emocoes_predominantes.length) kv("Emoções predominantes:", a.emocoes_predominantes.join("; "));
      if (a.tecnicas_usadas.length) kv("Técnicas utilizadas:", a.tecnicas_usadas.join("; "));
      if (a.fatos_observados.length) {
        h2("Fatos");
        bullets(a.fatos_observados);
      }
      if (a.hipoteses.length) {
        h2("Hipóteses");
        bullets(a.hipoteses.map((h) => `${h.texto} [confiança ${h.confianca}]`));
      }
      if (a.exercicio) kv("Exercício combinado:", `${a.exercicio.titulo} — ${a.exercicio.descricao}`);
      if (a.metas.length) kv("Metas:", a.metas.map((m) => `${m.titulo} (${m.status.replace("_", " ")})`).join("; "));
      if (a.pontos_para_proxima_sessao.length) kv("Pontos para a próxima sessão:", a.pontos_para_proxima_sessao.join("; "));
      kv("Observação ao profissional:", a.para_o_profissional);
    }

    // ---------------------------------------------------------------- 8
    h1("8", "Metas e exercícios");
    h2("Metas");
    if (d.goals.length) table([{ h: "Meta", w: 6 }, { h: "Situação", w: 2 }, { h: "Desde", w: 2.4 }], d.goals.map((g) => [g.title, g.status, g.created]));
    else para("Nenhuma meta registrada.", { color: MUTED, italic: true });
    para(r.metas_e_exercicios);
    h2("Exercícios");
    if (d.exercises.length) table([{ h: "Exercício", w: 3.2 }, { h: "Situação", w: 1.6 }, { h: "Devolutiva do participante", w: 4 }, { h: "Data", w: 2 }], d.exercises.map((e) => [`${e.title}: ${e.description}`, e.status.replace("_", " "), e.feedback ?? "—", e.completed ?? e.created]), { size: 8.5 });
    else para("Nenhum exercício registrado.", { color: MUTED, italic: true });

    // ---------------------------------------------------------------- 9
    h1("9", "Alertas de risco e tratamento");
    para(r.riscos_e_alertas);
    if (d.alerts.length)
      table(
        [{ h: "Data", w: 2.2 }, { h: "Nível", w: 1.2 }, { h: "Origem", w: 1.6 }, { h: "Trecho", w: 5 }, { h: "Situação / nota", w: 3 }],
        d.alerts.map((a) => [a.at, `${a.level} (${LEVEL(a.level)})`, a.source, a.excerpt, `${a.status.replace("_", " ")}${a.note ? ` — ${a.note}` : ""}${a.handledAt ? ` (${a.handledAt})` : ""}`]),
        { size: 8.5 },
      );
    else para("Nenhum alerta registrado.", { color: MUTED, italic: true });
    para("A IA apenas sinaliza risco: a avaliação e a conduta são sempre humanas.", { color: MUTED, size: 8.5 });

    // ---------------------------------------------------------------- 10
    h1("10", "Memória do caso");
    const m = d.memory;
    kv("Queixa principal:", m.queixa_principal);
    kv("Contexto de vida:", m.contexto_de_vida);
    kv("Histórico relevante:", m.historico_relevante);
    kv("Rede de apoio:", m.rede_de_apoio);
    kv("Preferências de comunicação:", m.preferencias_de_comunicacao);
    for (const [k, v] of [["Padrões (hipóteses)", m.padroes], ["Forças e recursos", m.forcas_e_recursos], ["O que funciona", m.o_que_funciona], ["O que evitar", m.o_que_evitar], ["Temas recorrentes", m.temas_recorrentes]] as const) {
      if (v.length) {
        h2(k);
        bullets(v);
      }
    }
    if (d.memoryVersions.length) {
      h2("Versões da memória (auditoria)");
      para(d.memoryVersions.map((v) => `v${v.version} — ${v.at}${v.sessionId ? ` (sessão id ${v.sessionId})` : ""}`).join("   |   "), { color: MUTED, size: 8.5 });
    }

    // ---------------------------------------------------------------- 11
    h1("11", "Limitações e uso responsável");
    para(r.limitacoes);
    bullets([
      "As conversas são conduzidas por uma IA de apoio emocional; não há avaliação clínica presencial.",
      "Escalas PHQ-2/GAD-2 são de rastreio. O estudo mede viabilidade, segurança e adesão — não eficácia clínica.",
      "Hipóteses automáticas não são diagnósticos e podem conter erros; transcrições automáticas de voz podem conter imprecisões.",
      "Este documento contém dados pessoais sensíveis: armazene, compartilhe e descarte conforme o protocolo aprovado pelo comitê de ética e a LGPD.",
    ]);

    // ---------------------------------------------------------------- anexos
    if (withTranscripts) {
      doc.addPage();
      h1("A", "Transcrições completas das sessões");
      para("Registro integral, na ordem em que ocorreu. “IA” = fala do agente; “Participante” = fala transcrita automaticamente do áudio do participante.", { color: MUTED, size: 8.5 });
      for (const s of d.sessions) {
        ensure(80);
        doc.moveDown(0.6);
        doc.rect(PAGE_M, doc.y, W, 20).fill("#eef2f6");
        doc.fillColor(INK).font("Helvetica-Bold").fontSize(10).text(`Sessão ${s.number} — ${KIND(s.kind)} — ${s.started}`, PAGE_M + 8, doc.y + 6, { width: W - 16 });
        doc.y += 14;
        doc.x = PAGE_M;
        if (!s.messages.length) {
          para("Sem falas registradas.", { color: MUTED, italic: true });
          continue;
        }
        for (const msg of s.messages) {
          ensure(34);
          const ai = msg.role === "assistant";
          doc.font("Helvetica-Bold").fontSize(8.5).fillColor(ai ? TEAL : INK).text(`${ai ? (d.agent?.name ?? "IA") + " (IA)" : "Participante"}`, PAGE_M, doc.y, { continued: true }).font("Helvetica").fillColor(MUTED).text(`   ${msg.at}`);
          doc.font("Helvetica").fontSize(9.5).fillColor(INK).text(clean(msg.content), PAGE_M + 10, doc.y, { width: W - 10, lineGap: 1.8 });
          doc.moveDown(0.45);
          doc.x = PAGE_M;
        }
      }

      doc.addPage();
      h1("B", "Mensagens de emergência (chat)");
      if (!d.chat.length) para("Nenhuma mensagem trocada neste canal.", { color: MUTED, italic: true });
      for (const msg of d.chat) {
        ensure(34);
        const ai = msg.role === "assistant";
        doc.font("Helvetica-Bold").fontSize(8.5).fillColor(ai ? TEAL : INK).text(ai ? `${d.agent?.name ?? "IA"} (IA)` : "Participante", PAGE_M, doc.y, { continued: true }).font("Helvetica").fillColor(MUTED).text(`   ${msg.at}`);
        doc.font("Helvetica").fontSize(9.5).fillColor(INK).text(clean(msg.content), PAGE_M + 10, doc.y, { width: W - 10, lineGap: 1.8 });
        doc.moveDown(0.45);
        doc.x = PAGE_M;
      }
    }

    // ---------------------------------------------------------------- cabeçalho/rodapé (todas menos a capa)
    const range = doc.bufferedPageRange();
    for (let i = range.start + 1; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0; // evita nova página automática ao escrever no rodapé
      doc.font("Helvetica-Bold").fontSize(8).fillColor(TEAL).text("Percurso", PAGE_M, 34, { lineBreak: false });
      doc.font("Helvetica").fillColor(MUTED).text(`Dossiê — Participante nº ${d.patient.id}  ·  CONFIDENCIAL`, PAGE_M, 34, { width: W, align: "right", lineBreak: false });
      doc.moveTo(PAGE_M, 48).lineTo(PAGE_M + W, 48).lineWidth(0.4).strokeColor(LINE).stroke();
      doc.fontSize(8).fillColor(MUTED).text(`Página ${i} de ${range.count - 1}`, PAGE_M, doc.page.height - 38, { width: W, align: "center", lineBreak: false });
    }
    doc.end();
  });
}
