import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase-server";
import { resolvePostAuthRedirect } from "@/src/lib/auth-provision";

// Single source of truth for "where does this authenticated user belong?".
// resolvePostAuthRedirect is role-aware (teacher → /dashboard, site_admin →
// /admin/upload-schedule, district_admin → /admin/usage, founder →
// /admin/teachers, pending → /pending, deactivated → /access-denied). The client
// landing page sends already-authenticated users here instead of guessing
// /dashboard — which previously trapped admin accounts in a /dashboard↔/pending
// loop (no teacher row → bounced to /pending → approved request → back to
// /dashboard).
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/`);
  }

  const path = await resolvePostAuthRedirect(user, origin);
  return NextResponse.redirect(`${origin}${path}`);
}
