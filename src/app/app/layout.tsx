import { requirePatient } from "@/lib/auth";
import { PatientNav } from "@/components/PatientNav";
import { CrisisStrip } from "@/components/ui";

export default async function PatientLayout({ children }: { children: React.ReactNode }) {
  const u = await requirePatient();
  return (
    <>
      <CrisisStrip />
      <PatientNav name={u.name} />
      <div className="max-w-5xl mx-auto px-5 py-8">{children}</div>
    </>
  );
}
