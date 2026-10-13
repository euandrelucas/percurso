import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PwaRegister } from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: { default: "Percurso — cuidado emocional acessível", template: "%s · Percurso" },
  description: "Projeto em desenvolvimento para democratizar o acesso ao acompanhamento psicológico, com apoio de IA e supervisão humana. Beta fechado, apenas por convite.",
  robots: { index: false, follow: false },
  manifest: "/manifest.webmanifest",
  applicationName: "Percurso",
  appleWebApp: { capable: true, title: "Percurso", statusBarStyle: "default" },
  icons: { icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }], apple: "/icons/apple-touch-icon.png" },
  formatDetection: { telephone: false },
};
export const dynamic = "force-dynamic"; // CSP com nonce exige renderização dinâmica
export const viewport: Viewport = { themeColor: "#0f1829", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
