import { NextResponse } from "next/server";
import { createClient } from "@/src/lib/supabase-server";

export async function POST(request: Request) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "Google OAuth not configured on server" },
      { status: 500 }
    );
  }

  // Verify the user is authenticated
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Get the teacher's refresh token from the database
  const { data: teacher, error: teacherError } = await supabase
    .from("teachers")
    .select("google_refresh_token")
    .eq("auth_id", user.id)
    .single();

  if (teacherError || !teacher?.google_refresh_token) {
    return NextResponse.json(
      { error: "No refresh token stored. Please sign out and sign back in." },
      { status: 404 }
    );
  }

  // Exchange refresh token for a new access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: teacher.google_refresh_token,
      grant_type: "refresh_token",
    }),
  });

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text();
    console.error("Google token refresh failed:", tokenRes.status, errBody);

    // If refresh token is revoked/invalid, clear it
    if (tokenRes.status === 400 || tokenRes.status === 401) {
      await supabase
        .from("teachers")
        .update({ google_refresh_token: null })
        .eq("auth_id", user.id);

      return NextResponse.json(
        { error: "Refresh token revoked. Please sign out and sign back in." },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: "Failed to refresh token" },
      { status: 500 }
    );
  }

  const tokenData = await tokenRes.json();

  return NextResponse.json({
    access_token: tokenData.access_token,
    expires_in: tokenData.expires_in, // seconds until expiry (usually 3600)
  });
}
