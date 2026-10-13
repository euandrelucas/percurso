// Gera o PDF do dossiê de um paciente para inspeção local. Uso: tsx --env-file=.env.local scripts/make-pdf.mts <userId> <saida.pdf>
import fs from "node:fs";
import { generateReport } from "../src/lib/analysis";
import { buildDossier } from "../src/lib/report-data";
import { renderReportPdf } from "../src/lib/report-pdf";
import { getReport } from "../src/lib/store";
import type { ReportData } from "../src/lib/types";

const id = Number(process.argv[2]);
const out = process.argv[3] ?? "dossie.pdf";
await generateReport(id, "script");
const rep = (await getReport<ReportData>(id))!;
const t0 = Date.now();
fs.writeFileSync(out, await renderReportPdf(rep.data, await buildDossier(id)));
console.log(`ok ${out} em ${Date.now() - t0} ms`);
process.exit(0);
