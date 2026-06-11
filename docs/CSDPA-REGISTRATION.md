# Getting DailyWins onto the California student-data-privacy registry

*Written 2026-06-11. This is the "is your tool on the registry?" answer that
placing districts will ask NPS directors — the longest-lead-time item on the
launch list, and it's paperwork + one district relationship, not code.*

## What this actually is (and isn't)

There is **no government agency and no license**. What districts check is the
**Student Data Privacy Consortium (SDPC) Resource Registry** — a searchable
database of signed privacy agreements, run by A4L (Access 4 Learning), a
nonprofit consortium. California's chapter is the **California Student Privacy
Alliance (CSPA)**. When a district privacy officer asks "are you CSDPA
listed?", they mean: *has any California LEA signed the standard agreement
with you, and is it posted in the registry so my district can join it?*

The instrument is the **NDPA (National Data Privacy Agreement)** with the
**California exhibits** — together commonly called the **CSDPA** (California
Student Data Privacy Agreement). One signature unlocks the state because of
**Exhibit E, the "General Offer of Privacy Terms"**: you sign the full
agreement once with one *originating LEA*, and every other California district
can adopt the identical terms by signing a one-page joinder. No renegotiation
per district.

The underlying laws you're agreeing to comply with: **FERPA** (federal),
**SOPIPA** (CA Bus. & Prof. Code §22584 — no ads, no profiling, no selling
student data), **AB 1584** (Ed. Code §49073.1 — required contract terms when a
vendor holds pupil records), and **COPPA** for under-13 users.

## The NPS wrinkle (why this matters for our 260 schools)

An NPS is **not an LEA** — the *placing district* is. The district's CSDPA
covers the students it places at the NPS. So the sales conversation goes:

> Director: "My placing districts require approved tools."
> Us: "DailyWins has a signed CSDPA with [originating LEA] including the
> General Offer — your districts can adopt it with a one-page joinder, or
> find us in the SDPC registry."

Without this, a district can veto an NPS's use of DailyWins regardless of how
good the demo was. With it, the objection evaporates in one email.

## The steps, in order

1. **Assemble the vendor packet** (one folder, reused forever):
   - Privacy policy (dailywins.school/privacy — **after the counsel pass**)
   - Data inventory: what we collect (student first name/display name, behavior
     scores, teacher notes; NO SSN, DOB, address, grades, photos)
   - Subprocessor list: Supabase (AWS us-east-1, Postgres + auth), Vercel
     (hosting), Resend (transactional email — staff emails only, never student
     data), Anthropic (bell-schedule PDF parsing only — no student data; not
     used for training)
   - Security summary: row-level security, role-based PII boundaries, audit
     logging of record access AND exports, encryption in transit/at rest,
     soft-delete record retention
   - Breach-notification commitment (AB 1584 requires it — 72-hour notice to
     affected LEAs is the standard answer)

2. **Download the current NDPA + California exhibits** from the SDPC site
   (privacy.a4l.org → "NDPA"). Read Exhibit B (the data-elements checklist —
   mark only what DailyWins actually collects) and Exhibit E (the General
   Offer — this is the one that scales).

3. **Recruit the originating LEA.** This is the real work, and **EGUSD is the
   natural candidate** — the July 13 meeting is the opening. The ask to their
   privacy/IT officer: "We'd like to execute the CSDPA with EGUSD as
   originating LEA, with Exhibit E." Districts sign these routinely; their
   privacy officer has a pile of them. A smaller, friendlier district also
   works if EGUSD moves slowly — any CA LEA can originate. (A placing district
   of an early NPS customer is another candidate.)

4. **Fill, sign, countersign.** Sure Step Education LLC signs as Provider.
   Expect 2–8 weeks of back-and-forth with the district's office; the most
   common friction points are the data-elements exhibit and the
   subprocessor/breach terms — the packet from step 1 answers all of it.

5. **Get it posted to the SDPC Resource Registry.** The LEA typically uploads
   the signed agreement to the registry; ask them to as part of signing. Also
   create a vendor profile at sdpc.a4l.org so DailyWins is searchable.
   (A4L membership is optional; the listing is what matters.)

6. **Put it everywhere.** Marketing site footer ("CSDPA signed · SDPC
   registry"), the NPS deck's compliance slide, the director email sequence,
   and the demo script's objection-handling section.

7. **Maintain it.** New subprocessor → notify per the agreement. Renewals are
   typically 3 years. Keep the signed PDF + joinders in one folder.

## What to start TODAY (lead-time order)

1. Counsel pass on /privacy §7 (already queued) — it's referenced by the DPA.
2. Email EGUSD's privacy officer asking for their CSDPA process — even before
   July 13, this is a normal vendor question and starts their clock.
3. Assemble the step-1 packet (Claude can draft every document in it).

## Adjacent badges (later, optional)

- **Common Sense Privacy** rating — parent-facing trust signal.
- **1EdTech TrustEd Apps** — some districts use it as a second filter.
- **Student Privacy Pledge** (FPF) — a signable public pledge; cheap goodwill.

None of these replace the CSDPA; the CSDPA is the gate.
