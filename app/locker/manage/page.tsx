import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/src/lib/supabase-server";
import { createAdminClient } from "@/src/lib/supabase-admin";
import ManageClient from "./ManageClient";

export const metadata: Metadata = { title: "Locker — class setup — DailyWins" };
export const dynamic = "force-dynamic";

// Teacher-side Locker management: activate for your class, print combo
// slips, see wallets, make audited adjustments. Teacher-row gated.
export default async function LockerManagePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/");

  const admin = createAdminClient();
  const { data: teacher } = await admin
    .from("teachers")
    .select("id, deactivated_at")
    .eq("auth_id", user.id)
    .maybeSingle();
  if (!teacher || teacher.deactivated_at) redirect("/auth/home");

  return <ManageClient />;
}
