import { requireAdmin } from "@/lib/auth";
import { AdminNav } from "@/components/AdminNav";
import { get } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin" };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  const open = get<{ n: number }>("SELECT COUNT(*) AS n FROM alerts WHERE status = 'aberto'")?.n ?? 0;
  return (
    <div className="md:flex">
      <AdminNav openAlerts={open} />
      <main className="flex-1 min-w-0 p-5 md:p-10 max-w-6xl">{children}</main>
    </div>
  );
}
