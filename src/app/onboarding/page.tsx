import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { Onboarding } from "@/components/Onboarding";

export const metadata = { title: "Primeiros passos" };

export default async function Page() {
  const u = await requireUser();
  if (u.role === "admin") redirect("/admin");
  if (u.onboarded) redirect("/app");
  return <Onboarding userName={u.name} />;
}
