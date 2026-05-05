import { NextResponse } from "next/server";
import { createAdminClient } from "@/src/lib/supabase-admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const email = searchParams.get("email")?.toLowerCase();
  if (!email) return NextResponse.json({ allowed: false });

  const admin = createAdminClient();
  const { data } = await admin
    .from("allowed_emails")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  return NextResponse.json({ allowed: !!data });
}
