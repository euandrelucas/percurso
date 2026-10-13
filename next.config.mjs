/** @type {import('next').NextConfig} */
const config = {
  output: "standalone",
  // pdfkit carrega as fontes (AFM) em tempo de execução: o tracer do standalone não as enxerga sozinho.
  outputFileTracingIncludes: { "/api/admin/users/[id]/pdf": ["./node_modules/pdfkit/js/**/*"] },
  serverExternalPackages: ["pdfkit", "@prisma/client", "prisma"],
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      // Service worker: nunca em cache longo, para atualizações chegarem rápido.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }, { key: "Service-Worker-Allowed", value: "/" }, { key: "Content-Type", value: "application/javascript; charset=utf-8" }] },
      { source: "/manifest.webmanifest", headers: [{ key: "Content-Type", value: "application/manifest+json" }, { key: "Cache-Control", value: "public, max-age=3600" }] },
    ];
  },
};

export default config;
