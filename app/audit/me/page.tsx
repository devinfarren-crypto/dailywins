import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/src/lib/supabase-server";
import { createAdminClient } from "@/src/lib/supabase-admin";
import {
  listAuditRowsAboutUser,
  listAuditRowsByUser,
} from "@/src/lib/audit-log-query";
import AuditRowList from "@/src/components/AuditRowList";

export const metadata: Metadata = {
  title: "Account access — DailyWins",
};

export const dynamic = "force-dynamic";

export default async function AccountAuditPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const admin = createAdminClient();
  const [aboutMe, byMe] = await Promise.all([
    listAuditRowsAboutUser(admin, user.id, 100),
    listAuditRowsByUser(admin, user.id, 100),
  ]);

  return (
    <main className="min-h-screen bg-[#f5f5f0] px-6 py-10">
      <section className="mx-auto w-full max-w-4xl space-y-10">
        <header>
          <h1 className="text-2xl md:text-3xl font-bold text-[#2a4d42]">
            Account access log
          </h1>
          <p className="mt-1 text-sm text-[#8a9690]">
            Who has acted as you, and what you&rsquo;ve done. Up to the last
            100 events per section.
          </p>
        </header>

        <div>
          <h2 className="mb-3 text-lg font-bold text-[#2a4d42]">
            Who acted as me
          </h2>
          <AuditRowList
            rows={aboutMe}
            emptyLabel="Nobody has acted as you. You'll see a row here whenever a founder or admin steps into your account under audit."
          />
        </div>

        <div>
          <h2 className="mb-3 text-lg font-bold text-[#2a4d42]">
            What I&rsquo;ve done
          </h2>
          <AuditRowList
            rows={byMe}
            emptyLabel="No actions recorded yet."
          />
        </div>
      </section>
    </main>
  );
}
