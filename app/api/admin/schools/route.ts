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

  const { data: isFounder, error: roleError } = await supabase.rpc("has_role", {
    p_role: "founder",
  });

  if (roleError) {
    console.error("Failed to verify founder role", roleError);
    return NextResponse.json({ error: "Unable to verify role" }, { status: 500 });
  }

  if (!isFounder) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("schools")
    .select("id, name, district")
    .order("name", { ascending: true });

  if (error) {
    console.error("Failed to list schools", error);
    return NextResponse.json({ error: "Unable to load schools" }, { status: 500 });
  }

  return NextResponse.json({ schools: data ?? [] });
}
