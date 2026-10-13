import { AuthForm } from "@/components/AuthForm";
export const metadata = { title: "Entrar" };
export default async function Page({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const erro = ((await searchParams).erro ?? "").toString().slice(0, 200);
  return <AuthForm mode="login" initialError={erro} />;
}
