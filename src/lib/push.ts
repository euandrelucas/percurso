import webpush from "web-push";
import { config } from "./config";
import { dec, enc } from "./crypto";
import { prisma } from "./prisma";
import { dayKey } from "./time";

// ---- Chaves VAPID: do ambiente (se definidas) ou geradas uma única vez e guardadas no banco (privada criptografada) ----------
type Vapid = { publicKey: string; privateKey: string };
let cached: Vapid | null = null;

export async function getVapid(): Promise<Vapid> {
  if (cached) return cached;
  const envPub = process.env.VAPID_PUBLIC_KEY?.trim();
  const envPriv = process.env.VAPID_PRIVATE_KEY?.trim();
  if (envPub && envPriv) return (cached = { publicKey: envPub, privateKey: envPriv });
  const [pub, priv] = await Promise.all([prisma.appSetting.findUnique({ where: { key: "vapid_public" } }), prisma.appSetting.findUnique({ where: { key: "vapid_private" } })]);
  const privPlain = priv ? dec(priv.value, "app.vapid") : null;
  if (pub && privPlain) return (cached = { publicKey: pub.value, privateKey: privPlain });
  const k = webpush.generateVAPIDKeys();
  await prisma.$transaction([
    prisma.appSetting.upsert({ where: { key: "vapid_public" }, create: { key: "vapid_public", value: k.publicKey }, update: { value: k.publicKey } }),
    prisma.appSetting.upsert({ where: { key: "vapid_private" }, create: { key: "vapid_private", value: enc(k.privateKey, "app.vapid")! }, update: { value: enc(k.privateKey, "app.vapid")! } }),
  ]);
  return (cached = { publicKey: k.publicKey, privateKey: k.privateKey });
}

const subject = () => process.env.VAPID_SUBJECT || (process.env.APP_URL?.startsWith("https://") ? process.env.APP_URL : "mailto:contato@percurso.local");

type Sub = { endpoint: string; p256dh: string; auth: string };

/** Envia um aviso. Retorna "gone" se o aparelho cancelou (a inscrição deve ser apagada). */
export async function sendPush(sub: Sub, payload: { title: string; body: string; url?: string }, send: typeof webpush.sendNotification = webpush.sendNotification): Promise<"ok" | "gone" | "error"> {
  const v = await getVapid();
  try {
    await send({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), {
      vapidDetails: { subject: subject(), publicKey: v.publicKey, privateKey: v.privateKey },
      TTL: 6 * 3600,
    });
    return "ok";
  } catch (e) {
    const code = (e as { statusCode?: number }).statusCode;
    return code === 404 || code === 410 ? "gone" : "error";
  }
}

// ---- Lembrete diário ----------------------------------------------------------------------------------------------------
const REMINDER_HOUR = 19; // horário de Brasília

const localHour = (d: Date) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: config.timezone, hour: "2-digit", hour12: false }).format(d)) % 24;

/** Texto neutro de propósito: a notificação aparece na tela bloqueada, então nunca cita saúde, temas ou nomes. */
export function reminderText(hasPendingExercise: boolean): { title: string; body: string; url: string } {
  return hasPendingExercise
    ? { title: "Percurso", body: "Seu exercício de hoje está esperando por você 💛", url: "/app" }
    : { title: "Percurso", body: "Quando quiser, a conversa de hoje está liberada. Sem pressa 💛", url: "/app" };
}

/** Roda a cada poucos minutos: às 19h envia no máximo UM lembrete por dia a quem ainda não conversou hoje. */
export async function runReminders(now = new Date(), send?: typeof webpush.sendNotification): Promise<number> {
  if (localHour(now) !== REMINDER_HOUR) return 0;
  const today = dayKey(now);
  const subs = await prisma.pushSubscription.findMany({ where: { user: { role: "patient", onboarded: true, status: "active" } } });
  let sent = 0;
  for (const s of subs) {
    if (s.last_sent_at && dayKey(s.last_sent_at) === today) continue;
    const [sessions, pending] = await Promise.all([
      prisma.therapySession.findMany({ where: { user_id: s.user_id, started_at: { gte: new Date(now.getTime() - 36 * 3600_000) } }, select: { started_at: true } }),
      prisma.exercise.count({ where: { user_id: s.user_id, status: "pendente" } }),
    ]);
    if (sessions.some((x) => dayKey(x.started_at) === today)) continue; // já conversou hoje
    const r = await sendPush(s, reminderText(pending > 0), send);
    if (r === "gone") await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
    else {
      await prisma.pushSubscription.update({ where: { id: s.id }, data: { last_sent_at: now } });
      if (r === "ok") sent++;
    }
  }
  return sent;
}

export function startReminderLoop() {
  const t = setInterval(() => void runReminders().catch((e) => console.warn("[push]", String(e).slice(0, 160))), 10 * 60_000);
  t.unref?.();
}
