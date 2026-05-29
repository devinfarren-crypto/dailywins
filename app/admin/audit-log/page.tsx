import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/src/lib/supabase-server";
import { createAdminClient } from "@/src/lib/supabase-admin";
import { listAllAuditRows } from "@/src/lib/audit-log-query";
import AuditRowList from "@/src/components/AuditRowList";

export const metadata: Metadata = {
  title: "Audit log — DailyWins",
};

export const dynamic = "force-dynamic";

export default async function AdminAuditLogPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const { data: isFounder } = await supabase.rpc("has_role", {
    p_role: "founder",
  });
  if (!isFounder) redirect("/dashboard");

  const admin = createAdminClient();
  const rows = await listAllAuditRows(admin, 200);

  return (
    <main className="min-h-screen bg-[#f5f5f0] px-6 py-10">
      <section className="mx-auto w-full max-w-5xl">
        <header className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-[#2a4d42]">
            Audit log
          </h1>
          <p className="mt-1 text-sm text-[#8a9690]">
            All administrative actions across the platform. Newest first; up to
            the last 200 events.
          </p>
        </header>

        <AuditRowList rows={rows} />
      </section>
    </main>
  );
}
