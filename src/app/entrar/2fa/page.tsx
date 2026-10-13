import { redirect } from "next/navigation";
import { pendingUser } from "@/lib/auth";
import { Logo } from "@/components/ui";
import { TwoFactorLogin } from "@/components/SecurityForms";

export const metadata = { title: "Verificação em duas etapas" };

export default async function Page({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  if (!(await pendingUser())) redirect("/entrar");
  const erro = ((await searchParams).erro ?? "").toString().slice(0, 200);
  return (
    <main className="min-h-dvh grid place-items-center px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center"><Logo /></div>
        <div className="card !p-7 fade-up">
          <h1 className="text-3xl font-semibold">Verificação em duas etapas</h1>
          <p className="text-muted mt-1.5 mb-6 text-sm">Digite o código de 6 dígitos do seu aplicativo autenticador.</p>
          <TwoFactorLogin initialError={erro} />
        </div>
      </div>
    </main>
  );
}
