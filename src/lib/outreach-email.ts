// The director outreach email — the first thing a prospective NPS school ever
// sees from DailyWins. Personal-letter register, one preview-image card, two
// links: the gift (their homepage refresh) and the personalized pitch page.
// Rendered server-side by /api/outreach/send from a per-school config.

export interface OutreachSchool {
  /** "The Phillips Academy" */
  name: string;
  /** "phillips-academy" — must match the public/for/<slug>/ folder */
  slug: string;
  /** Director's first name if known — falls back to a role greeting */
  directorFirstName?: string;
  /** One sentence tying the pitch to THEIR mission, written per school */
  missionHook: string;
  /** e.g. "Est. 1971" or "" */
  estLine?: string;
}

const ORIGIN = "https://dailywins.school";

export function outreachSubject(school: OutreachSchool): string {
  return `I rebuilt ${school.name}'s front page — it's yours, free`;
}

export function outreachText(school: OutreachSchool): string {
  const base = `${ORIGIN}/for/${school.slug}`;
  return [
    `Hi${school.directorFirstName ? ` ${school.directorFirstName}` : ""},`,
    "",
    `I'm Devin Farren — a Sacramento classroom teacher. I built DailyWins, a behavior and goal-progress tracker for non-public schools, and ${school.name} is exactly the kind of school I built it for.`,
    "",
    school.missionHook,
    "",
    `Before asking for any of your time, I wanted to give you something first: my team rebuilt your homepage as a modern concept — your mission, your colors, ${school.estLine || "your identity"} — and it's yours to keep whether or not we ever talk.`,
    "",
    `See your new front page: ${base}/site/`,
    `Try the 30-second teacher workflow (no signup): ${base}#demo`,
    "",
    `If it looks like something your staff would actually use: the 60-day pilot is free (no card, we do all the setup), and as one of the first 15 California schools you'd lock in the founding rate — $149/month flat, for life, instead of $199.`,
    "",
    `Just reply to this email and your teachers can be tracking by Friday.`,
    "",
    `— Devin`,
    `Devin Farren · Teacher & Founder, Sure Step Education · Sacramento, CA`,
    `dailywins.school`,
    "",
    `P.S. Even if DailyWins isn't for you, keep the website — consider it a thank-you for the work ${school.name} does.`,
    "",
    `You're receiving this one email because ${school.name} serves students in a way I deeply respect. Reply "no thanks" and you'll never hear from me again.`,
  ].join("\n");
}

export function outreachHtml(school: OutreachSchool): string {
  const base = `${ORIGIN}/for/${school.slug}`;
  const hi = `Hi${school.directorFirstName ? ` ${esc(school.directorFirstName)}` : ""},`;
  return `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:0;background:#F7F5F0;">
<div style="display:none;max-height:0;overflow:hidden;">A free homepage refresh for ${esc(school.name)} — and the 30-second behavior tracker built for NPS classrooms.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F7F5F0;padding:28px 12px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- brand bar -->
  <tr><td style="padding:0 8px 14px;">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="font-family:Georgia,serif;font-size:19px;color:#1a1a2e;">DailyWins</td>
      <td style="font-family:Courier,monospace;font-size:10px;letter-spacing:2px;color:#7a7a8e;padding-left:10px;">SURE STEP EDUCATION</td>
    </tr></table>
  </td></tr>

  <!-- letter -->
  <tr><td style="background:#FFFFFF;border:1px solid #ebe7da;border-radius:14px;padding:34px 34px 28px;font-family:Helvetica,Arial,sans-serif;font-size:15.5px;line-height:1.65;color:#1a1a2e;">
    <p style="margin:0 0 16px;">${hi}</p>
    <p style="margin:0 0 16px;">I'm <strong>Devin Farren</strong> — a Sacramento classroom teacher. I built
    <strong>DailyWins</strong>, a behavior &amp; goal-progress tracker for non-public schools, and
    ${esc(school.name)} is exactly the kind of school I built it for.</p>
    <p style="margin:0 0 16px;">${esc(school.missionHook)}</p>
    <p style="margin:0 0 20px;">Before asking for any of your time, I wanted to <strong>give you something
    first</strong>: my team rebuilt your homepage as a modern concept — your mission, your colors,
    ${esc(school.estLine || "your identity")} — and it's yours to keep whether or not we ever talk.</p>

    <!-- the gift card -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #ddd6c6;border-radius:12px;overflow:hidden;margin:0 0 8px;">
      <tr><td style="background:#16365c;padding:12px 18px;font-family:Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:1.5px;color:#ffffff;text-transform:uppercase;">
        Your new front page — a working concept
      </td></tr>
      <tr><td>
        <a href="${base}/site/" style="display:block;">
          <img src="${base}/preview.png" alt="Preview: ${esc(school.name)} homepage refresh" width="600" style="display:block;width:100%;border:0;">
        </a>
      </td></tr>
      <tr><td style="padding:16px 18px;background:#ffffff;">
        <a href="${base}/site/" style="display:inline-block;background:#a31f24;color:#ffffff;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:14px;padding:12px 22px;border-radius:999px;text-decoration:none;">See your new front page →</a>
        <span style="display:inline-block;font-family:Helvetica,Arial,sans-serif;font-size:12.5px;color:#7a7a8e;padding:12px 0 0 12px;">Free. No strings. Want it live? Reply and we hand over the files.</span>
      </td></tr>
    </table>

    <p style="margin:24px 0 16px;">And here's the actual product — <strong>the entire teacher workflow, live in
    your browser, no signup</strong>. Tap a few wins and watch the period grade itself:</p>
    <p style="margin:0 0 24px;">
      <a href="${base}#demo" style="display:inline-block;background:#1D9E75;color:#ffffff;font-family:Helvetica,Arial,sans-serif;font-weight:bold;font-size:15px;padding:13px 26px;border-radius:999px;text-decoration:none;">Try DailyWins — 30 seconds, nothing to install →</a>
    </p>

    <p style="margin:0 0 16px;">If it looks like something your staff would actually use: the
    <strong>60-day pilot is free</strong> — no card, no auto-convert, and we do the setup (bell schedule,
    rosters, IEP goal labels) for you. As one of the first 15 California schools, ${esc(school.name)}
    would lock in the founding rate: <strong>$149/month flat, for life</strong>, instead of $199.</p>
    <p style="margin:0 0 24px;"><strong>Just reply to this email</strong> and your teachers can be tracking by Friday.</p>

    <p style="margin:0;">— Devin</p>
    <p style="margin:4px 0 0;font-size:13px;color:#7a7a8e;">Devin Farren · Teacher &amp; Founder, Sure Step Education<br>
    <a href="https://dailywins.school" style="color:#1D9E75;">dailywins.school</a> · Sacramento, CA</p>

    <p style="margin:22px 0 0;font-size:13.5px;color:#4a4a5e;border-top:1px dashed #ebe7da;padding-top:16px;">
    <strong>P.S.</strong> Even if DailyWins isn't for you, keep the website — consider it a thank-you
    for the work ${esc(school.name)} does.</p>
  </td></tr>

  <!-- compliance footer -->
  <tr><td style="padding:18px 12px 6px;font-family:Helvetica,Arial,sans-serif;font-size:11.5px;line-height:1.6;color:#9a9aa8;text-align:center;">
    You're receiving this one email because ${esc(school.name)} serves students in a way I deeply respect.<br>
    Reply &quot;no thanks&quot; and you'll never hear from me again. · Sure Step Education, Sacramento, CA
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
