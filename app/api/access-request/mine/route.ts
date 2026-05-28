import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase-server";
import { createAdminClient } from "@/src/lib/supabase-admin";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("access_requests")
    .select("status, school_name")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Failed to load access request", error);
    return NextResponse.json({ error: "Unable to load request" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "Request not found" }, { status: 404 });
  }

  return NextResponse.json({
    status: data.status,
    school_name: data.school_name,
  });
}
