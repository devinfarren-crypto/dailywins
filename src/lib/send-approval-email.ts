import { Resend } from "resend";

// Tells a requester their access request was APPROVED — the missing half of
// the signup loop (before this, an approved teacher was never notified and
// had to re-visit the site on a hunch). Same conventions as
// send-teacher-invite: returns { sent } instead of throwing, so an email
// hiccup never breaks the approval itself.
export async function sendApprovalEmail(input: {
  to: string;
  origin: string;
  role: string;
  schoolName?: string | null;
  signInUrl?: string | null;
}): Promise<{ sent: boolean; error?: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_FROM_EMAIL;
  if (!apiKey || !from) {
    return { sent: false, error: "Email is not configured (RESEND_API_KEY / NOTIFY_FROM_EMAIL)." };
  }

  const fallback = `${input.origin}/?email=${encodeURIComponent(input.to)}`;
  const link = input.signInUrl ?? fallback;
  const direct = Boolean(input.signInUrl);
  const where = input.schoolName?.trim() ? ` at ${input.schoolName.trim()}` : "";
  const roleLabel =
    input.role === "site_admin"
      ? "site administrator"
      : input.role === "district_admin"
        ? "district administrator"
        : "teacher";

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to: input.to,
      subject: "You're approved — welcome to DailyWins",
      text: [
        `Good news: your DailyWins access request was approved. You're set up as a ${roleLabel}${where}.`,
        "",
        `Get started: ${link}`,
        "",
        direct
          ? `That link signs you in directly (valid 24 hours, one use). If it expires, go to ${fallback} and sign in with this email address (${input.to}).`
          : `Sign in with this email address (${input.to}) and you'll go straight to your dashboard.`,
      ].join("\n"),
      html: `
        <p>Good news: your <strong>DailyWins</strong> access request was approved.
        You're set up as a ${escapeHtml(roleLabel)}${escapeHtml(where)}.</p>
        <p><a href="${link}" style="display:inline-block;background:#0F6E56;color:#fff;
        padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">
        ${direct ? "Open my dashboard →" : "Sign in →"}</a></p>
        <p style="color:#6b6e69;font-size:13px;">${
          direct
            ? `That button signs you in directly (valid 24 hours, one use). If it expires, go to <a href="${fallback}">${escapeHtml(input.origin.replace(/^https?:\/\//, ""))}</a> and sign in with this email address (${escapeHtml(input.to)}).`
            : `Sign in with this email address (${escapeHtml(input.to)}) and you'll go straight to your dashboard.`
        }</p>
      `,
    });
    return { sent: true };
  } catch (err) {
    console.error("sendApprovalEmail failed", err);
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
