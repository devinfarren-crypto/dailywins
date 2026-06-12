import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { outreachHtml, outreachText, outreachSubject, type OutreachSchool } from "@/src/lib/outreach-email";

// Founder outreach sender — the send arm of the NPS sales system.
// Auth: the caller must present the service-role key as a bearer token
// (compared server-side, never echoed). Only founder machines hold that key,
// which is exactly the set of people allowed to send sales email as Devin.
// School pages live at public/for/<slug>/ — built per school, committed.
export async function POST(req: NextRequest) {
  const expected = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!expected || got !== expected) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    to?: string;
    school?: OutreachSchool;
    subject?: string;
  } | null;
  const to = typeof body?.to === "string" ? body.to.trim() : "";
  const school = body?.school;
  if (
    !to ||
    !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to) ||
    !school?.name ||
    !school?.slug ||
    !/^[a-z0-9-]+$/.test(school.slug) ||
    !school?.missionHook
  ) {
    return NextResponse.json({ ok: false, error: "bad_request" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  const fromEnv = process.env.NOTIFY_FROM_EMAIL;
  if (!apiKey || !fromEnv) {
    return NextResponse.json({ ok: false, error: "email_not_configured" }, { status: 500 });
  }
  // Keep the verified address, present as Devin (it's his outreach).
  const address = fromEnv.match(/<([^>]+)>/)?.[1] ?? fromEnv;
  const from = `Devin Farren · DailyWins <${address}>`;

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from,
      to,
      replyTo: "support@surestepeducation.com",
      subject: body?.subject?.trim() || outreachSubject(school),
      text: outreachText(school),
      html: outreachHtml(school),
    });
    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 502 });
    }
    return NextResponse.json({ ok: true, id: data?.id ?? null });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "send_failed" },
      { status: 502 }
    );
  }
}
