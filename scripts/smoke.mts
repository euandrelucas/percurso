/**
 * Teste de fumaça + segurança contra uma instância JÁ EM EXECUÇÃO.
 * Uso:  BASE=http://127.0.0.1:3100 ADMIN_EMAIL=... ADMIN_PASSWORD=... tsx --env-file=.env.local scripts/smoke.mts
 * Cria usuários e dados de teste (use um banco de desenvolvimento).
 */
import { hotp } from "../src/lib/totp";
import { prisma } from "../src/lib/prisma";

const BASE = process.env.BASE ?? "http://127.0.0.1:3100";
const ADMIN_EMAIL = process.env.ADMIN_EMAIL!;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD!;
// Estado limpo: o teste parte de um admin sem 2FA (apenas banco de desenvolvimento!).
if (process.env.NODE_ENV === "production" && !process.env.SMOKE_ALLOW) console.warn("(NODE_ENV=production no cliente do teste — ok, só afeta este script)");
await prisma.user.updateMany({ where: { email: ADMIN_EMAIL }, data: { totp_enabled: false, totp_secret: null, totp_last_step: null, failed_logins: 0, locked_until: null } });
await prisma.authSession.deleteMany({ where: { user: { email: ADMIN_EMAIL } } });
let failures = 0;
const check = (name: string, ok: boolean, extra = "") => {
  console.log(`${ok ? "[ok]" : "[FALHOU]"} ${name}${ok ? "" : `  ${extra}`}`);
  if (!ok) failures++;
};

class Client {
  cookie = "";
  async req(path: string, init: RequestInit & { json?: unknown; origin?: string | null } = {}) {
    const headers = new Headers(init.headers);
    if (this.cookie) headers.set("cookie", this.cookie);
    if (init.json !== undefined) {
      headers.set("content-type", "application/json");
      init.body = JSON.stringify(init.json);
    }
    if (init.origin !== null && init.method && init.method !== "GET") headers.set("origin", init.origin ?? BASE);
    const res = await fetch(BASE + path, { ...init, headers, redirect: "manual" });
    const sc = res.headers.getSetCookie?.() ?? [];
    for (const c of sc) {
      const [kv] = c.split(";");
      if (/Max-Age=0|expires=Thu, 01 Jan 1970/i.test(c)) this.cookie = "";
      else this.cookie = kv;
    }
    return res;
  }
  post = (p: string, json: unknown, origin?: string | null) => this.req(p, { method: "POST", json, origin });
}

const rnd = Math.random().toString(36).slice(2, 8);

// --- 1. Cabeçalhos de segurança --------------------------------------------------------------------------------------------
{
  const r = await fetch(BASE + "/");
  const csp = r.headers.get("content-security-policy") ?? "";
  check("CSP presente com nonce e frame-ancestors 'none'", /nonce-/.test(csp) && /frame-ancestors 'none'/.test(csp) && /object-src 'none'/.test(csp), csp);
  check("CSP sem 'unsafe-eval' em produção", !/unsafe-eval/.test(csp));
  check("X-Frame-Options / nosniff / COOP", r.headers.get("x-frame-options") === "DENY" && r.headers.get("x-content-type-options") === "nosniff" && r.headers.get("cross-origin-opener-policy") === "same-origin");
  check("Sem X-Powered-By", !r.headers.get("x-powered-by"));
  check("Cache-Control: no-store nas páginas", r.headers.get("cache-control")?.includes("no-store") ?? false);
  const h = await fetch(BASE + "/api/health");
  check("Healthcheck responde 200 e não vaza detalhes", h.status === 200 && (await h.text()) === '{"ok":true}');
  const sw = await fetch(BASE + "/sw.js");
  const mf = await fetch(BASE + "/manifest.webmanifest");
  check("PWA: sw.js e manifest servidos", sw.status === 200 && mf.status === 200 && (await mf.json()).display === "standalone");
}

// --- 2. CSRF -------------------------------------------------------------------------------------------------------------------
{
  const c = new Client();
  const r = await c.post("/api/auth/login", { email: "x@y.com", password: "abc" }, "https://evil.example");
  check("CSRF: POST de outra origem é bloqueado (403)", r.status === 403);
  const r2 = await c.post("/api/auth/login", { email: "x@y.com", password: "abc" });
  check("Login inválido responde 401 genérico", r2.status === 401);
}

// --- 3. Registro: política de senha e convite de uso único ---------------------------------------------------------------
const admin = new Client();
{
  const r = await admin.post("/api/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  check("Admin loga com senha", r.status === 200, await r.clone().text());
  const pg = await admin.req("/admin");
  const loc = pg.headers.get("location") ?? "";
  check("Admin sem 2FA é redirecionado para /admin/seguranca", pg.status === 307 && loc.includes("/admin/seguranca"), `${pg.status} ${loc}`);
  const inv = await admin.post("/api/admin/invites", { label: "x", count: 1 });
  check("API admin bloqueada até ativar 2FA", inv.status === 403);

  // ativa 2FA
  const setup = await (await admin.post("/api/admin/2fa/setup", {})).json();
  check("2FA setup devolve segredo e QR", !!setup.secret && String(setup.qr).startsWith("<svg"));
  const bad = await admin.post("/api/admin/2fa/enable", { code: "000000" });
  check("2FA enable rejeita código errado", bad.status === 401);
  const en = await admin.post("/api/admin/2fa/enable", { code: hotp(setup.secret, Math.floor(Date.now() / 30000)) });
  check("2FA enable aceita código correto", en.status === 200, await en.clone().text());
  const inv2 = await admin.post("/api/admin/invites", { label: `smoke-${rnd}`, count: 2 });
  check("Com 2FA ativo, admin gera convites", inv2.status === 200);
  (globalThis as unknown as { codes: string[]; secret: string }).codes = (await inv2.json()).codes;
  (globalThis as unknown as { secret: string }).secret = setup.secret;
}
const { codes, secret } = globalThis as unknown as { codes: string[]; secret: string };

const pat = new Client();
{
  const weak = await pat.post("/api/auth/register", { code: codes[0], name: "Paciente Teste", email: `p-${rnd}@t.com`, password: "12345678901" });
  check("Senha só com números é recusada", weak.status === 400);
  const wrong = await pat.post("/api/auth/register", { code: "PERC-AAAA-AAAA", name: "X Y", email: `q-${rnd}@t.com`, password: "Senha-Forte-2026!" });
  check("Convite inexistente recusado (mensagem genérica)", wrong.status === 403);
  const ok = await pat.post("/api/auth/register", { code: codes[0], name: "Paciente Teste", email: `p-${rnd}@t.com`, password: "Senha-Forte-2026!" });
  check("Cadastro com convite válido", ok.status === 200, await ok.clone().text());
  const again = await new Client().post("/api/auth/register", { code: codes[0], name: "Outro Nome", email: `r-${rnd}@t.com`, password: "Senha-Forte-2026!" });
  check("Convite não pode ser reutilizado", again.status === 403);

  const onb = await pat.post("/api/onboarding", {
    preferred_name: "Pat", agent_name: "Íris", voice: "marin", tone: "acolhedor", style: "equilibrado", formality: "informal", humor: "leve", pace: "normal",
    avatar: { skin: "#e8b48f", hair: "hair-long", hairColor: "#3b2a20", accessory: "none", accent: "#6366f1" }, consent: true, adult: true, phq2: [1, 1], gad2: [1, 2], selfHarm: "nao",
  });
  check("Onboarding concluído", onb.status === 200, await onb.clone().text());
  const noConsent = await new Client().post("/api/onboarding", { consent: false });
  check("Onboarding sem sessão = 401", noConsent.status === 401);
}

// --- 4. Isolamento entre pacientes e papéis --------------------------------------------------------------------------------
{
  check("Paciente não acessa API de admin", (await pat.post("/api/admin/invites", { count: 1 })).status === 403);
  const adminPage = await pat.req("/admin");
  check("Paciente é redirecionado para fora de /admin", adminPage.status === 307);
  const demo = await prisma.user.findFirst({ where: { email: "demo.paciente@percurso.test" } });
  if (demo) {
    const ex = await prisma.exercise.findFirst({ where: { user_id: demo.id } });
    const sess = await prisma.therapySession.findFirst({ where: { user_id: demo.id } });
    check("Paciente não altera exercício de outro", ex ? (await pat.post(`/api/exercises/${ex.id}`, { status: "feito" })).status === 404 : true);
    check("Paciente não encerra sessão de outro", sess ? (await pat.post(`/api/call/${sess.id}/end`, { reason: "paciente" })).status === 404 : true);
    check("Paciente não grava fala em sessão de outro", sess ? (await pat.post(`/api/call/${sess.id}/turn`, { role: "user", text: "oi" })).status === 404 : true);
  }
  const pdf = await pat.req(`/api/admin/users/1/pdf`);
  check("Paciente não baixa PDF de relatório", pdf.status === 403);
}

// --- 5. Fluxo: chamada (demo), chat, cifragem em repouso --------------------------------------------------------------------
{
  const start = await (await pat.post("/api/call/start", {})).json();
  check("Chamada iniciada (triagem)", start.kind === "triagem" && start.secondsLeft > 3000, JSON.stringify(start));
  await pat.post(`/api/call/${start.sessionId}/chat`, { text: "Tenho dormido mal e ando ansiosa" });
  const risk = await (await pat.post(`/api/call/${start.sessionId}/turn`, { role: "user", text: "às vezes eu queria sumir, não aguento mais" })).json();
  check("Fala de risco gera nível >= 2", risk.risk >= 2, JSON.stringify(risk));
  const chat = await (await pat.post("/api/chat", { text: "eu vou me matar hoje" })).json();
  check("Chat: risco alto devolve cartão de crise com 188/192", !!chat.crisis && /188/.test(chat.crisis.text) && /192/.test(chat.crisis.text));
  check("Entrada inválida (JSON gigante/vazio) é rejeitada", (await pat.post("/api/chat", { text: "" })).status === 400);
  const raw = await prisma.$queryRaw<{ content: string }[]>`SELECT content FROM messages ORDER BY id DESC LIMIT 5`;
  check("Mensagens estão cifradas no banco (enc:v1:)", raw.length > 0 && raw.every((r) => r.content.startsWith("enc:v1:")));
  const al = await prisma.$queryRaw<{ excerpt: string }[]>`SELECT excerpt FROM alerts ORDER BY id DESC LIMIT 3`;
  check("Alertas cifrados no banco", al.length > 0 && al.every((r) => r.excerpt.startsWith("enc:v1:")));
  await pat.post(`/api/call/${start.sessionId}/end`, { reason: "paciente" });
}

// --- 6. Força bruta e bloqueio de conta --------------------------------------------------------------------------------------
{
  const victim = `p-${rnd}@t.com`;
  const c = new Client();
  let last = 0;
  for (let i = 0; i < 6; i++) last = (await c.post("/api/auth/login", { email: victim, password: "senha-errada-123" })).status;
  const correct = await c.post("/api/auth/login", { email: victim, password: "Senha-Forte-2026!" });
  check("Após 5 falhas a conta bloqueia (mesmo com a senha certa)", correct.status === 429, `última=${last} certa=${correct.status}`);
  await prisma.user.updateMany({ where: { email: victim }, data: { locked_until: null, failed_logins: 0 } });
}

// --- 7. Sessões, 2FA no login e logout ---------------------------------------------------------------------------------------
{
  const a2 = new Client();
  const l = await a2.post("/api/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASSWORD });
  const lj = await l.json();
  check("Login do admin com 2FA pede o código", lj.next === "/entrar/2fa", JSON.stringify(lj));
  check("Sessão pendente de 2FA não acessa /admin", (await a2.req("/admin")).status === 307);
  check("Sessão pendente não acessa a API admin", (await a2.post("/api/admin/invites", { count: 1 })).status === 403);
  const wrong = await a2.post("/api/auth/2fa", { code: "123456" });
  check("2FA: código errado = 401", wrong.status === 401);
  const step = Math.floor(Date.now() / 30000);
  // o código do passo atual já foi usado em "enable" -> não pode ser reutilizado; usa o passo seguinte (tolerância ±1)
  const okc = await a2.post("/api/auth/2fa", { code: hotp(secret, step + 1) });
  check("2FA: código novo é aceito", okc.status === 200, await okc.clone().text());
  check("Admin acessa o painel após 2FA", (await a2.req("/admin")).status === 200);
  const pdf = await a2.req(`/api/admin/users/${(await prisma.user.findFirstOrThrow({ where: { email: "demo.paciente@percurso.test" } })).id}/pdf`);
  check("PDF do dossiê é entregue como application/pdf", pdf.status === 200 && (pdf.headers.get("content-type") ?? "").includes("pdf") && (await pdf.arrayBuffer()).byteLength > 5000, String(pdf.status));
  const old = a2.cookie;
  await a2.post("/api/auth/logout", {});
  const b = new Client();
  b.cookie = old;
  check("Cookie antigo não funciona após logout (sessão revogada)", (await b.req("/admin")).status === 307);
}

// --- 8. Auditoria registrou os eventos sensíveis -----------------------------------------------------------------------------
{
  const acts = (await prisma.auditLog.findMany({ select: { action: true }, take: 200, orderBy: { id: "desc" } })).map((a) => a.action);
  check("Auditoria: login/2FA/convite/alerta registrados", ["2fa.enabled", "invite.created", "user.registered", "alert.raised", "login.failed"].every((a) => acts.includes(a)), acts.slice(0, 20).join(","));
}

console.log(failures ? `\n${failures} verificação(ões) falharam.` : "\nTudo certo.");
await prisma.$disconnect();
process.exit(failures ? 1 : 0);
