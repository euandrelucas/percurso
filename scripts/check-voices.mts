/**
 * Verifica, SEM gastar áudio, quais vozes o modelo Realtime configurado aceita (cria um client_secret por voz).
 * Uso:  npm run check:voices            (usa OPENAI_API_KEY e OPENAI_REALTIME_MODEL do .env.local)
 *       OPENAI_REALTIME_MODEL=gpt-realtime npm run check:voices   para comparar com o modelo completo
 */
import { VOICES } from "../src/lib/prompts/options";

const key = process.env.OPENAI_API_KEY;
if (!key) {
  console.error("Defina OPENAI_API_KEY.");
  process.exit(1);
}
const model = process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-mini";
console.log(`Modelo: ${model}\n`);
let bad = 0;
for (const v of VOICES) {
  const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ expires_after: { anchor: "created_at", seconds: 60 }, session: { type: "realtime", model, audio: { output: { voice: v.id } } } }),
  });
  const ok = res.ok;
  if (!ok) bad++;
  console.log(`${ok ? "✅" : "❌"} ${v.id.padEnd(8)} ${v.desc}${ok ? "" : `  → ${res.status} ${(await res.text()).slice(0, 160).replace(/\s+/g, " ")}`}`);
}
console.log(bad ? `\n${bad} voz(es) recusada(s): o app usa a voz "alloy" como reserva automática, mas vale tirar a voz recusada da lista.` : "\nTodas as vozes aceitas.");
process.exit(bad ? 1 : 0);
