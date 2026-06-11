import { Resend } from "resend";

// Sends a teacher their invite email. Returns whether it was actually sent
// (false if Resend isn't configured). Swallows its own errors so a send failure
// surfaces as { sent: false } rather than throwing into the invite flow.
export async function sendTeacherInvite(input: {
  to: string;
  origin: string;
  schoolName: string;
  inviterName?: string;
  // Server-minted one-click sign-in link (auth/confirm token_hash URL). When
  // present the invite is a single email: click → signed in → dashboard.
  signInUrl?: string | null;
}): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_FROM_EMAIL;

  if (!apiKey || !from) {
    return { sent: false, error: "Email is not configured (RESEND_API_KEY / NOTIFY_FROM_EMAIL)." };
  }

  // Primary: the direct sign-in link (one click, no second email). Fallback:
  // the landing page with the teacher's email pre-filled.
  const fallback = `${input.origin}/?email=${encodeURIComponent(input.to)}`;
  const link = input.signInUrl ?? fallback;
  const direct = Boolean(input.signInUrl);
  const inviter = input.inviterName?.trim()
    ? `${input.inviterName.trim()} invited you`
    : "You've been invited";

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to: input.to,
      subject: `You're invited to DailyWins — ${input.schoolName}`,
      text: [
        `${inviter} to join DailyWins as a teacher at ${input.schoolName}.`,
        "",
        `Get started: ${link}`,
        "",
        direct
          ? `That link signs you in directly (valid 24 hours, one use). If it expires, go to ${fallback} and sign in with this email address (${input.to}).`
          : `Sign in with this email address (${input.to}) and you'll go straight to your classroom dashboard.`,
        "",
        "Tip: bookmark dailywins.school (not this link — sign-in links are one-time). That page signs you in with this email whenever you need, and you'll stay signed in on devices you use regularly.",
      ].join("\n"),
      html: `
        <p>${escapeHtml(inviter)} to join <strong>DailyWins</strong> as a teacher at
        <strong>${escapeHtml(input.schoolName)}</strong>.</p>
        <p><a href="${link}" style="display:inline-block;background:#0F6E56;color:#fff;
        padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">
        ${direct ? "Accept invite &amp; sign in →" : "Get started →"}</a></p>
        <p style="color:#6b6e69;font-size:13px;">${
          direct
            ? `That button signs you in directly (valid 24 hours). If it expires, go to <a href="${fallback}">${escapeHtml(input.origin.replace(/^https?:\/\//, ""))}</a> and sign in with this email address (${escapeHtml(input.to)}).`
            : `Sign in with this email address (${escapeHtml(input.to)}) and you'll go straight to your classroom dashboard.`
        }</p>
        <p style="color:#6b6e69;font-size:13px;">Tip: bookmark <a href="https://dailywins.school">dailywins.school</a> (not this link — sign-in links are one-time). That page signs you in with this email whenever you need, and you'll stay signed in on devices you use regularly.</p>
      `,
    });
    return { sent: true };
  } catch (err) {
    console.error("sendTeacherInvite failed", err);
    return { sent: false, error: err instanceof Error ? err.message : "Send failed" };
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
