import { cookies } from "next/headers";
import { requirePatient } from "@/lib/auth";
import { PatientNav } from "@/components/PatientNav";
import { CrisisStrip } from "@/components/ui";
import { InstallPrompt } from "@/components/PwaRegister";
import type { FontSize, Theme } from "@/components/ThemeControls";

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const u = await requirePatient();
  const jar = await cookies();
  const t = jar.get("pc_theme")?.value;
  const theme: Theme = t === "dark" || t === "light" ? t : "auto";
  const size: FontSize = jar.get("pc_fs")?.value === "large" ? "large" : "normal";
  return (
    <div data-pc-shell data-theme={theme} data-fs={size} className="pc-shell">
      <CrisisStrip />
      <PatientNav name={u.name} theme={theme} size={size} />
      <div className="max-w-5xl mx-auto px-5 py-8"><InstallPrompt />{children}</div>
    </div>
  );
}
