import { PrismaClient, Prisma } from "@prisma/client";

const g = globalThis as unknown as { __prisma?: PrismaClient };

export const prisma: PrismaClient =
  g.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
if (process.env.NODE_ENV !== "production") g.__prisma = prisma;

/** Trilha de auditoria append-only. Nunca lança: auditoria não pode derrubar a requisição. */
export async function audit(actor: string, action: string, userId?: number | null, detail?: Prisma.InputJsonValue, ip?: string) {
  try {
    await prisma.auditLog.create({ data: { actor, action, user_id: userId ?? null, detail: detail ?? Prisma.JsonNull, ip: ip ?? null } });
  } catch (e) {
    console.error("[audit]", e);
  }
}

export { Prisma };
