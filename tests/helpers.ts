// Banco de TESTE isolado (percurso_test). Crie com:  createdb percurso_test && DATABASE_URL=... npx prisma migrate deploy
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://percurso:percurso_dev@localhost:5432/percurso_test?schema=public";
process.env.MOCK_AI = "1";
process.env.AUTH_SECRET = "test-secret-0123456789abcdef";
process.env.ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

export async function resetDb() {
  const { prisma } = await import("../src/lib/prisma");
  await prisma.$executeRawUnsafe("TRUNCATE TABLE users, invites, audit_log RESTART IDENTITY CASCADE");
  return prisma;
}
