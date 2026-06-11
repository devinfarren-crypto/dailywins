import { Resend } from "resend";

// The rescue email: a fresh one-click sign-in link for someone who lost their
// invite/approval email. Sent from the Teachers page ("Resend sign-in") or the
// requests page — the 8pm "I can't get in" answer. Same conventions as the
// other senders: returns { sent }, never throws into the caller.
export async function sendSigninLink(input: {
  to: string;
  origin: string;
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

  try {
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from,
      to: input.to,
      subject: "Your DailyWins sign-in link",
      text: [
        "Here's a fresh sign-in link for DailyWins:",
        "",
        link,
        "",
        direct
          ? `That link signs you in directly (valid 24 hours, one use). You can ALWAYS sign in without any email: go to ${fallback} and request a link with this address (${input.to}).`
          : `Sign in with this email address (${input.to}) and you'll land on your home page.`,
        "",
        "Tip: bookmark dailywins.school (not this link — sign-in links are one-time). That page signs you in with this email whenever you need, and you'll stay signed in on devices you use regularly.",
      ].join("\n"),
      html: `
        <p>Here's a fresh sign-in link for <strong>DailyWins</strong>:</p>
        <p><a href="${link}" style="display:inline-block;background:#0F6E56;color:#fff;
        padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600;">
        Sign in to DailyWins →</a></p>
        <p style="color:#6b6e69;font-size:13px;">${
          direct
            ? `That button signs you in directly (valid 24 hours, one use). You can <strong>always</strong> sign in without any saved email: go to <a href="${fallback}">${escapeHtml(input.origin.replace(/^https?:\/\//, ""))}</a> and request a link with this address (${escapeHtml(input.to)}).`
            : `Sign in with this email address (${escapeHtml(input.to)}) and you'll land on your home page.`
        }</p>
        <p style="color:#6b6e69;font-size:13px;">Tip: bookmark <a href="https://dailywins.school">dailywins.school</a> (not this link — sign-in links are one-time). That page signs you in with this email whenever you need, and you'll stay signed in on devices you use regularly.</p>
      `,
    });
    return { sent: true };
  } catch (err) {
    console.error("sendSigninLink failed", err);
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
