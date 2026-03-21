"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const supabase = createClient();

    // PKCE flow: after Google auth, Supabase redirects here with ?code=
    // Exchange it for a session using the BROWSER client (which has access
    // to the code_verifier cookie it stored during signInWithOAuth).
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");

    if (code) {
      supabase.auth.exchangeCodeForSession(code).then(({ data, error: err }) => {
        // Clean the URL after exchange attempt (not before — Supabase may read location)
        window.history.replaceState({}, "", "/");

        if (err) {
          console.error("Code exchange failed:", err.message, err);
          setError(`Sign in failed: ${err.message}`);
          setChecking(false);
          return;
        }
        console.log("Code exchange succeeded, session:", !!data.session);
        // If Google returned a Drive token (personal accounts only — EGUSD blocks drive.file scope)
        if (data.session?.provider_token) {
          localStorage.setItem("dailywins_google_token", data.session.provider_token);
          localStorage.setItem("dailywins_google_token_expiry", String(Date.now() + 3500 * 1000));
        }
        if (data.session?.provider_refresh_token) {
          const supabaseForSave = createClient();
          supabaseForSave.from("teachers")
            .update({ google_refresh_token: data.session.provider_refresh_token })
            .eq("auth_id", data.session.user.id)
            .then(({ error: saveErr }) => {
              if (saveErr) console.error("Failed to save refresh token:", saveErr);
            });
        }
        router.replace("/dashboard");
      });
      return;
    }

    // No code — check if user already has a session
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        router.replace("/dashboard");
      } else {
        setChecking(false);
      }
    });
  }, [router]);

  const handleGoogleSignIn = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  if (checking) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "#f0f2f5" }}>
        <div style={{ background: "white", borderRadius: 16, padding: 32, textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
          <div style={{
            background: "#6366f1",
            width: 48, height: 48, borderRadius: 12,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", fontWeight: 800, fontSize: 18,
            margin: "0 auto 16px",
          }}>DW</div>
          <div style={{ color: "#333", fontSize: 14, fontWeight: 600 }}>Signing in...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md px-8">
        <div className="rounded-2xl bg-white p-10 shadow-xl">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-2xl font-bold text-white shadow-lg">
              DW
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              DailyWins
            </h1>
            <p className="mt-2 text-sm text-gray-500">
              Classroom behavior tracking for your school
            </p>
          </div>

          <div className="mb-8 border-t border-gray-200" />

          {error && (
            <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#dc2626", fontSize: 13, fontWeight: 600 }}>
              {error}
            </div>
          )}

          <button
            onClick={handleGoogleSignIn}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
            </svg>
            Sign in with Google
          </button>

          <p className="mt-8 text-center text-xs text-gray-400">
            Sign in with your school Google account
          </p>
        </div>
      </div>
    </div>
  );
}
