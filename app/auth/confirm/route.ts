import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/src/lib/supabase-server";
import { resolvePostAuthRedirect } from "@/src/lib/auth-provision";

// Email magic-link / signup confirmation entry point. The Supabase email
// templates point here with a one-time token_hash:
//   /auth/confirm?token_hash={{ .TokenHash }}&type=...
// verifyOtp validates that token_hash server-side and needs NO code_verifier
// cookie, so the link works even when opened on a different device or browser
// than the one that requested it (request on a laptop, click on a phone).
//
// As a safety net it also accepts a PKCE ?code= (the older flow Supabase emits
// when a template still uses {{ .ConfirmationURL }}). That path requires the
// same-browser code_verifier cookie, so it's only a fallback during the
// template cutover — once the templates use token_hash it's never exercised.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const inviteToken = searchParams.get("invite")?.trim() ?? "";

  const supabase = await createClient();

  if (tokenHash && type) {
    const { data, error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (error || !data.session?.user) {
      console.error("Email token verification failed:", error?.message);
      return NextResponse.redirect(`${origin}/?error=auth`);
    }
    const redirectPath = await resolvePostAuthRedirect(
      data.session.user,
      origin,
      inviteToken
    );
    return NextResponse.redirect(`${origin}${redirectPath}`);
  }

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error || !data.session?.user) {
      console.error("Auth code exchange failed:", error?.message);
      return NextResponse.redirect(`${origin}/?error=auth`);
    }
    const redirectPath = await resolvePostAuthRedirect(
      data.session.user,
      origin,
      inviteToken
    );
    return NextResponse.redirect(`${origin}${redirectPath}`);
  }

  return NextResponse.redirect(`${origin}/?error=auth`);
}
