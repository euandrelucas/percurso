// Janela deslizante em memória. Suficiente para uma instância única (o deploy padrão do compose).
const hits = new Map<string, number[]>();

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) {
    hits.set(key, arr);
    return false;
  }
  arr.push(now);
  hits.set(key, arr);
  return true;
}

// Limpeza periódica para o mapa não crescer indefinidamente.
const g = globalThis as unknown as { __rlTimer?: NodeJS.Timeout };
if (!g.__rlTimer) {
  g.__rlTimer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) {
      const f = v.filter((t) => now - t < 3_600_000);
      if (f.length) hits.set(k, f);
      else hits.delete(k);
    }
  }, 600_000);
  g.__rlTimer.unref?.();
}

/**
 * IP do cliente. Só confia em X-Forwarded-For se TRUST_PROXY=1 (atrás do Caddy do compose);
 * caso contrário um atacante poderia forjar o cabeçalho para escapar do rate limit.
 */
export function clientIp(req: Request): string {
  if (process.env.TRUST_PROXY === "1") {
    const xf = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (xf) return xf.slice(0, 64);
  }
  return "direct";
}
