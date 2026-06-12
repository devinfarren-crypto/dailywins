import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/src/lib/supabase-admin";
import { resolveLockerIdentity } from "@/src/lib/locker/session";
import LockerClient from "./LockerClient";

export const metadata: Metadata = { title: "Your Locker — DailyWins" };
export const dynamic = "force-dynamic";

// The locker. Cookie-gated: no claimed device → a friendly "use your class
// link" note (we can't know their class code from here).
export default async function LockerPage() {
  const admin = createAdminClient();
  const identity = await resolveLockerIdentity(admin);
  if (!identity) redirect("/locker/lost");
  return <LockerClient />;
}
