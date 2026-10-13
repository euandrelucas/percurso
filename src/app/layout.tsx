import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Percurso — cuidado emocional acessível", template: "%s · Percurso" },
  description: "Projeto em desenvolvimento para democratizar o acesso ao acompanhamento psicológico, com apoio de IA e supervisão humana. Beta fechado, apenas por convite.",
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { themeColor: "#f8f5ef", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
