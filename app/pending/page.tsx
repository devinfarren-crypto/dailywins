import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/src/lib/supabase-server";
import { createAdminClient } from "@/src/lib/supabase-admin";
import PendingClient from "./PendingClient";

export const metadata: Metadata = {
  title: "Access pending — DailyWins",
};

export const dynamic = "force-dynamic";

export default async function PendingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Unauthenticated visitors don't belong here — send them to sign in.
  if (!user) {
    redirect("/");
  }

  // Read the user's own request with the admin client (a pending user can't
  // necessarily read their access_requests row through RLS).
  const admin = createAdminClient();
  const { data: request } = await admin
    .from("access_requests")
    .select("status, school_name")
    .eq("user_id", user.id)
    .maybeSingle();

  // Already approved → the app proper. No request / denied → terminal page.
  if (!request) {
    redirect("/access-denied");
  }
  if (request.status === "approved") {
    redirect("/dashboard");
  }
  if (request.status !== "pending") {
    redirect("/access-denied");
  }

  return (
    <PendingClient
      initialStatus={request.status}
      initialSchoolName={request.school_name ?? ""}
    />
  );
}
