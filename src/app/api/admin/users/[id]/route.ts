import { apiUser } from "@/lib/auth";
import { bad, json, readJson } from "@/lib/api";
import { audit, run } from "@/lib/db";

/** Ações do admin sobre um paciente: suspender/reativar e ajustar limite diário de chamadas. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const admin = await apiUser("admin");
  if (!admin) return bad("Não autorizado", 403);
  const id = Number((await ctx.params).id);
  const b = await readJson(req);
  if (b?.action === "suspend") run("UPDATE users SET status = 'suspended' WHERE id = ? AND role = 'patient'", id);
  else if (b?.action === "reactivate") run("UPDATE users SET status = 'active' WHERE id = ? AND role = 'patient'", id);
  else if (b?.action === "calls_per_day") {
    const n = b.value === null || b.value === "" ? null : Number(b.value);
    if (n !== null && (!Number.isInteger(n) || n < 0 || n > 10)) return bad("Valor inválido");
    run("UPDATE users SET calls_per_day = ? WHERE id = ? AND role = 'patient'", n, id);
  } else return bad("Ação inválida");
  audit("admin", `user.${b.action}`, id, { value: b.value });
  return json({ ok: true });
}
