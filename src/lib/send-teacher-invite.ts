import { Resend } from "resend";

// Sends a teacher their invite email. Returns whether it was actually sent
// (false if Resend isn't configured). Swallows its own errors so a send failure
// surfaces as { sent: false } rather than throwing into the invite flow.
export async function sendTeacherInvite(input: {
  to: string;
  origin: string;
  schoolName: string;
  inviterName?: string;
}): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_FROM_EMAIL;

  if (!apiKey || !from) {
    return { sent: false, error: "Email is not configured (RESEND_API_KEY / NOTIFY_FROM_EMAIL)." };
  }

  // Pre-fill the teacher's email on the landing page so they just request a
  // sign-in link. Auto-provisioning happens on sign-in via the email-bound invite.
  const link = `${input.origin}/?email=${encodeURIComponent(input.to)}`;
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
        `Sign in with this email address (${input.to}) and you'll go straight to your classroom dashboard.`,
      ].join("\n"),
      html: `
        <p>${escapeHtml(inviter)} to join <strong>DailyWins</strong> as a teacher at
        <strong>${escapeHtml(input.schoolName)}</strong>.</p>
        <p><a href="${link}" style="display:inline-block;background:#1c5c3c;color:#fff;
        padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">
        Get started →</a></p>
        <p style="color:#6b6e69;font-size:13px;">Sign in with this email address
        (${escapeHtml(input.to)}) and you'll go straight to your classroom dashboard.</p>
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
