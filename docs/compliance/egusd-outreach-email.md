# Draft email — EGUSD privacy officer (the clock-starter)

*Drafted 2026-06-11. Send to EGUSD's student-data-privacy / Ed-Tech approval
contact (often titled "Director of Technology Services" or routed via their
ed-tech request form — check egusd.net's technology department page first;
many districts require the request to come through a sponsoring
teacher/admin, in which case Devin's own school relationship is the route).*

---

**Subject: CSDPA / NDPA execution request — DailyWins (Sure Step Education)**

Hello [Name],

I'm Devin Farren, founder of Sure Step Education and a teacher at Pleasant
Grove High School. We make **DailyWins** (dailywins.school), a classroom
behavior-goal tracking tool currently piloted by EGUSD teachers at Pleasant
Grove and Cosumnes Oaks.

We'd like to execute the **California Student Data Privacy Agreement (NDPA
with California exhibits)** with Elk Grove Unified, and we're hoping EGUSD
will serve as our **originating LEA**, with **Exhibit E (General Offer of
Privacy Terms)** included so other districts can adopt the same terms.

To make your review fast, here's the short version of our data posture:

- We collect three things about students: a teacher-entered name, per-period
  behavior marks, and teacher observation notes. No DOB, no SSID, no grades,
  no demographics, no photos, no contact information.
- Students have no accounts; parents access via revocable, expiring links.
- District-level administrators are PII-blind **by database design** (row-level
  security), and our own staff cannot read student records in normal
  operation — all privileged access is logged in an append-only audit trail.
- No advertising, no profiling, no sale of data, no model training on student
  data (SOPIPA-aligned). Data is hosted in the US (AWS us-east-1).

I've attached our completed Exhibit B worksheet, data inventory, subprocessor
list, security summary, and breach-notification commitment. Happy to complete
your district's vendor questionnaire or meet with your team.

What are the next steps in EGUSD's process?

Thank you,
Devin Farren
Sure Step Education · dailywins.school
[phone]

---

*Attachments to convert to PDF before sending: data-inventory.md,
subprocessors.md, security-summary.md, breach-notification.md,
exhibit-b-worksheet.md (+ /privacy once counsel-passed).*
