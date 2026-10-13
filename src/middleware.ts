import { NextRequest, NextResponse } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const IS_PROD = process.env.NODE_ENV === "production";
const APP_HOST = (() => {
  try {
    return process.env.APP_URL ? new URL(process.env.APP_URL).host : null;
  } catch {
    return null;
  }
})();
const HTTPS = (process.env.APP_URL ?? "").startsWith("https://");

function csp(nonce: string): string {
  const dev = !IS_PROD;
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "media-src 'self' blob: mediastream:",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws: wss:" : ""}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(HTTPS ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}

export function middleware(req: NextRequest) {
  // --- Proteção CSRF: requisições que alteram estado só passam se vierem do próprio site -------------------------
  if (!SAFE_METHODS.has(req.method)) {
    const host = req.headers.get("host");
    const origin = req.headers.get("origin");
    const site = req.headers.get("sec-fetch-site");
    let ok = true;
    if (origin) {
      try {
        const oh = new URL(origin).host;
        ok = oh === host || (!!APP_HOST && oh === APP_HOST);
      } catch {
        ok = false;
      }
    } else if (site) {
      ok = site === "same-origin" || site === "none";
    }
    if (!ok) return NextResponse.json({ error: "Origem não permitida" }, { status: 403 });
  }

  const nonce = btoa(crypto.randomUUID());
  const policy = csp(nonce);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", policy);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", policy);
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Referrer-Policy", "same-origin");
  res.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.headers.set("Permissions-Policy", "camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()");
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  res.headers.set("Cross-Origin-Resource-Policy", "same-origin");
  if (HTTPS) res.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  // Páginas e APIs autenticadas nunca devem ser guardadas em cache (navegador, proxies ou service worker).
  if (!req.nextUrl.pathname.startsWith("/_next/")) res.headers.set("Cache-Control", "no-store");
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icons/|favicon.ico|sw.js|manifest.webmanifest).*)"],
};
