import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/src/lib/supabase-server";
import RequestsClient from "./RequestsClient";

export const metadata: Metadata = {
  title: "Beta Access Requests — DailyWins",
};

export const dynamic = "force-dynamic";

export default async function AdminRequestsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  const { data: isFounder } = await supabase.rpc("has_role", {
    p_role: "founder",
  });

  if (!isFounder) {
    redirect("/dashboard");
  }

  const { data: requests, error } = await supabase
    .from("access_requests")
    .select(
      "id, email, full_name, school_name, status, created_at, reviewed_at"
    )
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load access requests", error);
  }

  return <RequestsClient initialRequests={requests ?? []} />;
}
