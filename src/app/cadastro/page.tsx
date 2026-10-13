import { AuthForm } from "@/components/AuthForm";
export const metadata = { title: "Criar conta" };
export default async function Page({ searchParams }: { searchParams: Promise<{ code?: string; erro?: string }> }) {
  const sp = await searchParams;
  const code = (sp.code ?? "").toString().slice(0, 40).replace(/[^A-Za-z0-9-]/g, "");
  const erro = (sp.erro ?? "").toString().slice(0, 200);
  return <AuthForm mode="register" defaultCode={code} initialError={erro} />;
}
