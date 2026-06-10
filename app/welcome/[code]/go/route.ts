import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/src/lib/supabase-server";
import { createAdminClient } from "@/src/lib/supabase-admin";
import { resolvePostAuthRedirect } from "@/src/lib/auth-provision";

// Consumes a short invite sign-in link: looks up the stored one-time token,
// verifies it (sets the session cookies via the cookie-aware server client),
// marks the code used, and lands the teacher on their post-auth home.
// POST-only on purpose — the /welcome page's button submits here, so a mail
// scanner prefetching the GET link never burns the token.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { origin } = new URL(request.url);

  const admin = createAdminClient();
  const { data: link } = await admin
    .from("invite_signin_links")
    .select("token_hash, otp_type, email, used_at, expires_at")
    .eq("code", code)
    .maybeSingle();

  if (!link || link.used_at !== null || new Date(link.expires_at) < new Date()) {
    const emailParam = link?.email ? `?email=${encodeURIComponent(link.email)}` : "";
    return NextResponse.redirect(`${origin}/${emailParam}`, 303);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.verifyOtp({
    type: link.otp_type as EmailOtpType,
    token_hash: link.token_hash,
  });

  // Mark used regardless: the token is one-time, so a failed verify means it's
  // dead anyway and the /welcome page should show the sign-in fallback.
  await admin
    .from("invite_signin_links")
    .update({ used_at: new Date().toISOString() })
    .eq("code", code);

  if (error || !data.session?.user) {
    console.error("welcome-link verification failed:", error?.message);
    return NextResponse.redirect(
      `${origin}/?email=${encodeURIComponent(link.email)}`,
      303
    );
  }

  const redirectPath = await resolvePostAuthRedirect(data.session.user, origin, "");
  return NextResponse.redirect(`${origin}${redirectPath}`, 303);
}
