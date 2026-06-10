import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

// Mints a one-time sign-in token for an email and parks it behind a short
// branded /welcome/<code> URL (invite_signin_links, single-use, 24h).
// generateLink sends nothing itself — the caller embeds the returned URL in
// its own email. Returns null on any failure so callers can fall back to the
// plain prefilled landing link.
//
// magiclink works for existing accounts; invite is the fallback that also
// creates the auth user for a brand-new email.
export async function createWelcomeLink(
  admin: SupabaseClient,
  email: string,
  origin: string
): Promise<string | null> {
  try {
    let linkRes = await admin.auth.admin.generateLink({ type: "magiclink", email });
    if (linkRes.error) {
      linkRes = await admin.auth.admin.generateLink({ type: "invite", email });
    }
    const props = linkRes.data?.properties;
    if (linkRes.error || !props?.hashed_token) {
      if (linkRes.error) console.error("generateLink failed", linkRes.error.message);
      return null;
    }
    const code = randomBytes(9).toString("base64url");
    const { error } = await admin.from("invite_signin_links").insert({
      code,
      token_hash: props.hashed_token,
      otp_type: props.verification_type ?? "magiclink",
      email,
    });
    if (error) {
      console.error("invite_signin_links insert failed", error.message);
      return null;
    }
    return `${origin}/welcome/${code}`;
  } catch (err) {
    console.error("createWelcomeLink threw", err);
    return null;
  }
}
