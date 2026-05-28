import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase-server";
import { createAdminClient } from "@/src/lib/supabase-admin";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    school_name?: string;
  };

  const schoolName = body.school_name?.trim();
  if (!schoolName) {
    return NextResponse.json({ error: "School name is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("access_requests").upsert(
    {
      user_id: user.id,
      email: user.email?.toLowerCase() ?? "",
      full_name:
        user.user_metadata?.full_name ??
        user.email?.split("@")[0] ??
        "Teacher",
      school_name: schoolName,
      status: "pending",
    },
    { onConflict: "user_id" }
  );

  if (error) {
    console.error("Failed to update access request school", error);
    return NextResponse.json({ error: "Unable to save school" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
