import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase-server";
import { createAdminClient } from "@/src/lib/supabase-admin";

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

  const admin = createAdminClient();
  const email = user.email.toLowerCase();

  const { data: existingTeacher } = await admin
    .from("teachers")
    .select("id")
    .eq("auth_id", user.id)
    .maybeSingle();

  const { data: existingRoleAssignment } = await admin
    .from("role_assignments")
    .select("role")
    .eq("user_id", user.id)
    .in("role", ["teacher", "site_admin", "district_admin", "founder"])
    .maybeSingle();

  if (existingTeacher || existingRoleAssignment) {
    return NextResponse.redirect(`${origin}/dashboard`);
  }

  if (inviteToken) {
    try {
      const { error: inviteError } = await admin.rpc("redeem_invite", {
        p_raw_token: inviteToken,
      });

      if (!inviteError) {
        return NextResponse.redirect(`${origin}/dashboard`);
      }

      console.error("Invite redemption failed:", inviteError.message);
    } catch (inviteFailure) {
      console.error("Invite redemption threw:", inviteFailure);
    }
  }

  const { data: requestRow } = await admin
    .from("access_requests")
    .select("status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (requestRow) {
    if (requestRow.status === "approved") {
      return NextResponse.redirect(`${origin}/dashboard`);
    }

    if (requestRow.status === "pending") {
      return NextResponse.redirect(`${origin}/pending`);
    }

    return NextResponse.redirect(`${origin}/access-denied`);
  }

  const fullName =
    user.user_metadata?.full_name ??
    user.user_metadata?.name ??
    user.email?.split("@")[0] ??
    "Teacher";

  const { error: upsertError } = await admin.from("access_requests").upsert(
    {
      user_id: user.id,
      email,
      full_name: fullName,
      status: "pending",
    },
    { onConflict: "user_id" }
  );

  if (upsertError) {
    console.error("Failed to auto-create access request:", upsertError.message);
  }

  return NextResponse.redirect(`${origin}/pending`);
}
