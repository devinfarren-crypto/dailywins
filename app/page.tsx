"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/src/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [magicBusy, setMagicBusy] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [magicError, setMagicError] = useState("");

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

        // Closed-pilot allowlist: bounce non-allowed emails to /access-denied.
        const email = data.session?.user.email?.toLowerCase();
        if (!email) {
          supabase.auth.signOut().finally(() => router.replace("/access-denied"));
          return;
        }
        fetch(`/api/auth/check-allowed?email=${encodeURIComponent(email)}`)
          .then((r) => r.json())
          .then(({ allowed }) => {
            if (!allowed) {
              supabase.auth.signOut().finally(() => router.replace("/access-denied"));
              return;
            }
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
          })
          .catch((e) => {
            console.error("Allowlist check failed:", e);
            supabase.auth.signOut().finally(() => router.replace("/access-denied"));
          });
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
        queryParams: { prompt: "select_account" },
      },
    });
  };

  // Passwordless email sign-in for accounts outside the Google ecosystem
  // (e.g. proton/outlook). Routes the magic link through /auth/confirm, which
  // verifies a token_hash server-side (no code_verifier cookie required) so the
  // link works even when opened on a different device than it was requested on.
  // The provisioning gate (access-request approval, RLS) is shared with the
  // Google /auth/callback path. shouldCreateUser is left at its default (true)
  // so a new tester lands in /pending awaiting approval.
  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setMagicError("Enter your email address.");
      return;
    }
    setMagicError("");
    setMagicBusy(true);
    const supabase = createClient();
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    });
    setMagicBusy(false);
    if (otpError) {
      setMagicError(otpError.message);
      return;
    }
    setMagicSent(true);
  };

  if (checking) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "var(--ssd-paper)" }}>
        <div style={{ background: "var(--ssd-surface)", borderRadius: "var(--ssd-radius)", border: "1px solid var(--ssd-border)", padding: 32, textAlign: "center", boxShadow: "var(--ssd-shadow)" }}>
          <div style={{
            background: "var(--ssd-ink)",
            width: 44, height: 44, borderRadius: "var(--ssd-radius-sm)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", fontWeight: 600, fontSize: 16,
            margin: "0 auto 14px",
          }}>DW</div>
          <div className="ssd-eyebrow" style={{ marginBottom: 2 }}>Signing in</div>
          <div style={{ color: "var(--ssd-text-muted)", fontSize: 14 }}>One moment…</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--ssd-paper)", display: "flex", flexDirection: "column" }}>
      <main style={{ flex: 1, width: "100%", maxWidth: 1200, margin: "0 auto", padding: "48px 24px" }}>
        <div className="flex flex-col gap-10 md:flex-row md:gap-14 md:items-center">
          {/* LEFT COLUMN — 60% on desktop */}
          <div className="w-full md:w-3/5">
            {/* Logo + wordmark */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 32 }}>
              <div style={{
                width: 30, height: 30, borderRadius: "var(--ssd-radius-sm)", background: "var(--ssd-ink)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "white", fontWeight: 600, fontSize: 12, letterSpacing: "0.02em",
              }}>DW</div>
              <span style={{ fontWeight: 600, fontSize: 18, letterSpacing: "-0.01em" }}>
                <span style={{ color: "var(--ssd-ink)" }}>Daily</span>
                <span style={{ color: "var(--ssd-amber-deep)" }}>Wins</span>
              </span>
            </div>

            {/* Mono eyebrow */}
            <p className="ssd-eyebrow" style={{ margin: "0 0 14px" }}>· Built by a teacher ·</p>

            {/* Headline — display serif with a single green emphasis clause */}
            <h1
              className="text-balance"
              style={{
                fontFamily: "var(--ssd-font-display), Georgia, serif",
                fontWeight: 500,
                fontSize: "clamp(32px, 4.4vw, 44px)",
                color: "var(--ssd-ink)",
                lineHeight: 1.12,
                letterSpacing: "-0.01em",
                margin: "0 0 18px",
                maxWidth: 620,
              }}
            >
              Behavior tracking that{" "}
              <span style={{ color: "var(--ssd-green)" }}>takes seconds,</span>{" "}
              not class periods.
            </h1>

            {/* Subheadline */}
            <p style={{ fontSize: 16, lineHeight: 1.6, color: "var(--ssd-text)", margin: "0 0 30px", maxWidth: 540 }}>
              Built by a teacher, for teachers. Track student behavior across all your periods, share progress with parents, and never lose another data point to a paper roster again.
            </p>

            {/* Demo video */}
            <div style={{ position: "relative", aspectRatio: "16/9", borderRadius: "var(--ssd-radius)", overflow: "hidden", border: "1px solid var(--ssd-border)", boxShadow: "var(--ssd-shadow)", marginBottom: 24 }}>
              <iframe
                src="https://www.youtube.com/embed/Apg6t8i7rl4"
                title="DailyWins demo"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
              />
            </div>

            {/* Trust badges */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 20, fontSize: 13, color: "var(--ssd-text-muted)" }}>
              {["FERPA-aligned", "AB 1584-compliant", "Pilot teachers love it"].map((label) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--ssd-green)", display: "inline-block" }} />
                  {label}
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT COLUMN — 40% on desktop */}
          <div className="w-full md:w-2/5">
            {/* House "card" look: full border + one thin green accent edge */}
            <div style={{
              background: "var(--ssd-surface)",
              borderRadius: "var(--ssd-radius)",
              border: "1px solid var(--ssd-border)",
              borderLeft: "3px solid var(--ssd-green)",
              padding: "30px 26px",
              boxShadow: "var(--ssd-shadow)",
            }}>
              <p className="ssd-eyebrow" style={{ margin: "0 0 8px" }}>Sign in</p>
              <h2 style={{ fontFamily: "var(--ssd-font-display), Georgia, serif", fontSize: 22, fontWeight: 500, color: "var(--ssd-ink)", margin: "0 0 6px" }}>
                Welcome back
              </h2>
              <p style={{ fontSize: 13, color: "var(--ssd-text-muted)", margin: "0 0 20px" }}>
                Pilot teachers and approved accounts only.
              </p>

              {error && (
                <div style={{ background: "#fbeae6", border: "1px solid var(--ssd-status-support)", borderRadius: "var(--ssd-radius-sm)", padding: "10px 14px", marginBottom: 16, color: "#9c3a22", fontSize: 13, fontWeight: 600 }}>
                  {error}
                </div>
              )}

              {/* Secondary button: transparent, ink border, ink text */}
              <button
                onClick={handleGoogleSignIn}
                className="flex w-full items-center justify-center gap-3 px-4 py-3 text-sm font-medium transition-colors"
                style={{ border: "1px solid var(--ssd-ink)", borderRadius: "var(--ssd-radius-sm)", background: "transparent", color: "var(--ssd-ink)" }}
              >
                <svg className="h-[18px] w-[18px]" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Sign in with Google
              </button>

              {/* Divider */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0" }}>
                <span style={{ flex: 1, height: 1, background: "var(--ssd-border)" }} />
                <span className="ssd-eyebrow" style={{ fontSize: 11 }}>or</span>
                <span style={{ flex: 1, height: 1, background: "var(--ssd-border)" }} />
              </div>

              {magicSent ? (
                <div style={{ background: "var(--ssd-surface-alt)", border: "1px solid var(--ssd-border)", borderLeft: "3px solid var(--ssd-green)", borderRadius: "var(--ssd-radius-sm)", padding: "12px 14px", fontSize: 13, color: "var(--ssd-text)", lineHeight: 1.5 }}>
                  Check your inbox — we sent a sign-in link to{" "}
                  <span style={{ fontWeight: 600 }}>{email.trim().toLowerCase()}</span>.
                  The link opens DailyWins and expires shortly.
                  <button
                    onClick={() => { setMagicSent(false); setMagicError(""); }}
                    style={{ display: "block", marginTop: 8, background: "none", border: "none", padding: 0, color: "var(--ssd-green-deep)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                  >
                    Use a different email
                  </button>
                </div>
              ) : (
                <form onSubmit={handleMagicLink}>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@school.org"
                    autoComplete="email"
                    className="w-full px-4 py-3 text-sm"
                    style={{ border: "1px solid var(--ssd-border)", borderRadius: "var(--ssd-radius-sm)", color: "var(--ssd-text)", background: "var(--ssd-surface)" }}
                  />
                  {magicError && (
                    <p style={{ margin: "8px 0 0", fontSize: 12, color: "#9c3a22", fontWeight: 500 }}>
                      {magicError}
                    </p>
                  )}
                  {/* Primary button: green-deep fill, white text */}
                  <button
                    type="submit"
                    disabled={magicBusy}
                    className="mt-3 flex w-full items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ background: "var(--ssd-green-deep)", borderRadius: "var(--ssd-radius-sm)" }}
                  >
                    {magicBusy ? "Sending…" : "Email me a sign-in link"}
                  </button>
                </form>
              )}

              <p style={{ marginTop: 16, textAlign: "center", fontSize: 12, color: "var(--ssd-text-muted)" }}>
                By signing in you agree to our <a href="/privacy" style={{ color: "var(--ssd-green-deep)", textDecoration: "none", fontWeight: 500 }}>privacy policy</a>.
              </p>

              <div style={{ marginTop: 22, paddingTop: 18, borderTop: "1px solid var(--ssd-border)" }}>
                <p style={{ fontSize: 12, color: "var(--ssd-text-muted)", margin: "0 0 6px" }}>
                  Want to bring DailyWins to your school?
                </p>
                <a
                  href="mailto:devin@surestepeducation.com?subject=DailyWins%20pilot%20interest"
                  style={{ fontSize: 13, fontWeight: 600, color: "var(--ssd-green-deep)", textDecoration: "none" }}
                >
                  Request a pilot →
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Page footer */}
      <footer style={{ borderTop: "1px solid var(--ssd-border)", padding: "16px 24px", marginTop: 32 }}>
        <div style={{
          maxWidth: 1200, margin: "0 auto",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          flexWrap: "wrap", gap: 8,
          fontSize: 12, color: "var(--ssd-text-muted)",
        }}>
          <span>
            A product of <span style={{ color: "var(--ssd-green-deep)", fontWeight: 600 }}>Sure Step Education</span>
          </span>
          <span className="ssd-eyebrow" style={{ fontSize: 11 }}>dailywins.school</span>
        </div>
      </footer>
    </div>
  );
}
