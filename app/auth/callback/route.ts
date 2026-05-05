import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase-server";
import { createAdminClient } from "@/src/lib/supabase-admin";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const email = data.session?.user.email?.toLowerCase() ?? null;
      if (!email) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/access-denied`);
      }

      const admin = createAdminClient();
      const { data: allowed } = await admin
        .from("allowed_emails")
        .select("email")
        .eq("email", email)
        .maybeSingle();

      if (!allowed) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}/access-denied`);
      }

      return NextResponse.redirect(`${origin}/dashboard`);
    }

    console.error("Auth code exchange failed:", error.message);
  }

  // Auth error — redirect back to login
  return NextResponse.redirect(`${origin}/?error=auth`);
}
