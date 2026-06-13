import type { Metadata } from "next";
import { createAdminClient } from "@/src/lib/supabase-admin";

export const metadata: Metadata = { title: "Welcome — DailyWins" };
export const dynamic = "force-dynamic";

// Branded landing for a short invite sign-in link (dailywins.school/welcome/<code>).
// Deliberately an interstitial: the one-time token is only consumed by the
// button's POST (./go), so mail-scanner prefetches of this GET can't burn it.

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "var(--ssd-navy, #252a4a)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          background: "var(--ssd-surface, #fff)",
          borderRadius: 18,
          padding: "36px 34px",
          maxWidth: 430,
          width: "100%",
          textAlign: "center",
          boxShadow: "0 18px 50px rgba(0,0,0,.35)",
        }}
      >
        <svg width="64" height="64" viewBox="0 0 200 200" aria-hidden="true" style={{ marginBottom: 14 }}>
          <rect x="38" y="120" width="22" height="40" rx="3" fill="#5DCAA5" />
          <rect x="68" y="98" width="22" height="62" rx="3" fill="#1D9E75" />
          <rect x="98" y="74" width="22" height="86" rx="3" fill="#0F6E56" />
          <rect x="128" y="48" width="22" height="112" rx="3" fill="#1a1a2e" />
          <path d="M38 150 C 78 124, 128 100, 158 36" stroke="#EF9F27" strokeWidth="6" strokeLinecap="round" fill="none" />
          <circle cx="158" cy="36" r="8" fill="#EF9F27" />
        </svg>
        {children}
      </div>
    </main>
  );
}

const h1Style: React.CSSProperties = {
  fontFamily: "var(--ssd-font-display), Georgia, serif",
  fontSize: 26,
  fontWeight: 500,
  color: "var(--ssd-ink, #1a1a2e)",
  margin: "0 0 8px",
};
const pStyle: React.CSSProperties = {
  fontSize: 14.5,
  lineHeight: 1.55,
  color: "var(--ssd-text-muted, #7a7a8e)",
  margin: "0 0 22px",
};

export default async function WelcomePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const admin = createAdminClient();
  const { data: link } = await admin
    .from("invite_signin_links")
    .select("email, used_at, expires_at")
    .eq("code", code)
    .maybeSingle();

  const expired =
    !link || link.used_at !== null || new Date(link.expires_at) < new Date();

  if (expired) {
    const emailParam = link?.email ? `?email=${encodeURIComponent(link.email)}` : "";
    return (
      <Shell>
        <h1 style={h1Style}>This link has been used</h1>
        <p style={pStyle}>
          Welcome links work once and expire after 24 hours. No problem — you can
          sign in any time with your school email address.
        </p>
        <a
          href={`/${emailParam}`}
          style={{
            display: "inline-block",
            background: "var(--ssd-green-deep, #0F6E56)",
            color: "#fff",
            borderRadius: 999,
            padding: "12px 26px",
            fontSize: 15,
            fontWeight: 700,
            textDecoration: "none",
          }}
        >
          Sign in to DailyWins
        </a>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 style={h1Style}>Welcome to DailyWins</h1>
      <p style={pStyle}>
        You&apos;re one click from your classroom dashboard, signed in as{" "}
        <strong style={{ color: "var(--ssd-ink, #1a1a2e)" }}>{link.email}</strong>.
      </p>
      <form method="post" action={`/welcome/${encodeURIComponent(code)}/go`}>
        <button
          type="submit"
          style={{
            background: "var(--ssd-green-deep, #0F6E56)",
            color: "#fff",
            border: "none",
            borderRadius: 999,
            padding: "13px 30px",
            fontSize: 16,
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Open my dashboard →
        </button>
      </form>
      <p style={{ ...pStyle, fontSize: 12, margin: "18px 0 0" }}>
        Built by teachers. Built to work. · Sure Step Education
      </p>
    </Shell>
  );
}
