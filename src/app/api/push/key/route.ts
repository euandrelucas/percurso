import { apiUser } from "@/lib/auth";
import { bad, json } from "@/lib/api";
import { getVapid } from "@/lib/push";

/** Chave pública (VAPID) para o navegador criar a inscrição de lembretes. */
export async function GET() {
  const user = await apiUser("patient");
  if (!user) return bad("Não autenticado", 401);
  return json({ key: (await getVapid()).publicKey });
}
