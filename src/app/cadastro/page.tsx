import { AuthForm } from "@/components/AuthForm";
export const metadata = { title: "Criar conta" };
export default async function Page({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const code = ((await searchParams).code ?? "").toString().slice(0, 40).replace(/[^A-Za-z0-9-]/g, "");
  return <AuthForm mode="register" defaultCode={code} />;
}
