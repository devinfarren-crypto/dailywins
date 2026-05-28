import { Resend } from "resend";

// Notifies the founder when a new access request lands. No-op if Resend isn't
// configured — wire up RESEND_API_KEY + NOTIFY_FROM_EMAIL + NOTIFY_TO_EMAIL to
// turn it on. Always swallows its own errors so a notification failure never
// breaks the sign-in flow that called it.
export async function notifyNewAccessRequest(input: {
  email: string;
  fullName: string;
  requestId: string;
  origin: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFY_FROM_EMAIL;
  const to = process.env.NOTIFY_TO_EMAIL;

  if (!apiKey || !from || !to) {
    return;
  }

  try {
    const resend = new Resend(apiKey);
    const adminUrl = `${input.origin}/admin/requests`;

    await resend.emails.send({
      from,
      to,
      subject: `New DailyWins beta request: ${input.email}`,
      text: [
        `${input.fullName} (${input.email}) just requested beta access to DailyWins.`,
        "",
        `Review: ${adminUrl}`,
      ].join("\n"),
      html: `
        <p><strong>${escapeHtml(input.fullName)}</strong>
        (${escapeHtml(input.email)}) just requested beta access to DailyWins.</p>
        <p><a href="${adminUrl}">Review the queue →</a></p>
      `,
    });
  } catch (err) {
    console.error("notifyNewAccessRequest failed", err);
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
