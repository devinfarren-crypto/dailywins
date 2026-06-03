import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase-server";
import { resolvePostAuthRedirect } from "@/src/lib/auth-provision";

// OAuth (Google) callback. The provider redirects here with a PKCE ?code= that
// we exchange for a session — this requires the code_verifier cookie set when
// the flow began, which is always present because OAuth completes in the same
// browser that started it. Email magic-links use /auth/confirm instead, since
// those can be opened on a different device. Both share resolvePostAuthRedirect.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const inviteToken = searchParams.get("invite")?.trim() ?? "";

  if (!code) {
    return NextResponse.redirect(`${origin}/?error=auth`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Auth code exchange failed:", error.message);
    return NextResponse.redirect(`${origin}/?error=auth`);
  }

  const user = data.session?.user;
  if (!user?.email) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/access-denied`);
  }

  const redirectPath = await resolvePostAuthRedirect(user, origin, inviteToken);
  return NextResponse.redirect(`${origin}${redirectPath}`);
}
