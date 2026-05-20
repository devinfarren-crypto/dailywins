**DailyWins Tiered Architecture — Design Doc v1.1**

Author: Devin Farren

Date: May 10, 2026

Status: Approved by Nicholas Crabtree (architecture). Implementation pending.

Replaces: v1 (May 10, 2026)

# **What changed in v1.1**

This revision incorporates feedback from Nicholas Crabtree and his TransitionReady-side technical review. Substantive changes:

- **Four tiers, not three. **Added District Admin between Founder and Site Admin. District Admin is also structurally PII-blind. Mirrors TransitionReady's role hierarchy and gives Sure Step a consistent platform-wide trust posture across products.

- **Site VP renamed to Site Admin. **Nick's terminology, and more accurate — covers principals, APs, deans, and other school-level admins, not just VPs specifically.

- **Founder = Sure Step Director. **Internal name aligned with how Nick refers to the role in TransitionReady. "Founder" remains usable interchangeably.

- **Students continue to use magic links for v1. **Full student accounts and The Locker (rewards/customization layer) deferred to a later phase. Confirmed by Nick: prioritize finishing the existing scope before building out The Locker.

- **Phase 1.5 added: staging environment with realistic data. **Required before Phase 2 begins. Role-aware RLS is the highest-risk phase — testing in staging before applying to production is non-negotiable.

- **Phase 1 gains JSONB validation. **Zod on the way in plus a Postgres CHECK constraint as a safety net. Without it, one malformed Site Admin edit breaks every teacher's dashboard at that school.

- **Phase 2 gains explicit dual-role test cases. **The interim Founder + Teacher state during migration is exactly where RLS bugs hide. Test cases written before migration, not after.

- **Phase 3 (magic links) adds revocation and IP/UA logging. **Teachers and Site Admins can revoke active magic links. Every link USE (not just creation) is logged with IP and User-Agent. Required for FERPA defensibility if a parent later disputes whether they viewed something.

- **Audit retention is TBD pending EGUSD input. **Districts sometimes require longer than 2 years for student-records-adjacent logs. Will confirm with the EGUSD CTO and lock in then.

# **Why this doc exists**

Nick shared the TransitionReady tiered architecture and asked how DailyWins compares. The honest answer was that DailyWins was single-tier (teachers only). This doc lays out the v1 tiered architecture for DailyWins, the decisions behind it, and the build sequence. The goal is parity with TransitionReady on the architectural commitments that matter for FERPA defensibility and district-scale deployment.

This is also the answer to a real product problem: hardcoded bell schedules in TypeScript don't scale past a handful of schools. Tiered architecture is the right place to solve it, because schedules belong to schools, and schools need administrators.

# **The roles (v1)**

Four roles in v1. Two more roles (full Student accounts with The Locker, full Parent accounts) are deferred until they're actually needed.

## **Founder / Sure Step Director**

The vendor oversight role. Today, that's Devin. Eventually, anyone with operational responsibility for the platform. Aligned with TransitionReady's "Sure Step Director" naming.

**CAN:**

- Create and deactivate districts

- Create and deactivate District Admins

- View aggregate platform metrics (counts, usage stats)

- View the full audit log

- Use act-as (view-only) to inspect what other roles see

**CANNOT:**

- View any individual student's behavior scores, names, or PII

- View any specific teacher's roster

- View any specific note content

- Edit schedules (Site Admin's job)

- Edit any teacher's data

- Make writes while in act-as mode

**Rationale: **The Founder is structurally blind to PII. This isn't a UI rule — it's enforced at the Postgres RLS layer. The privacy policy can claim "the founder cannot see student data" because the database refuses to return those rows to the Founder's user ID. This matches TransitionReady's Director role and is the architectural commitment that makes vendor-tier privacy operationally enforceable rather than aspirational.

## **District Admin**

New tier in v1.1. Oversees multiple schools within a district. Examples: a special education director, a transition coordinator, an assistant superintendent for student services.

**CAN:**

- Create and deactivate Site Admins within their district

- Create and deactivate schools within their district

- View aggregate stats across their district (number of teachers, schools, usage patterns)

- Read audit log entries scoped to their district

- Generate invite links for Site Admins at their schools

**CANNOT:**

- View any individual student's behavior scores or notes

- View any specific teacher's data or roster

- View other districts' data

- Edit bell schedules (Site Admin's job)

- Make writes while in act-as mode (if/when act-as extends to District Admin)

**Rationale: **District Admin is structurally PII-blind, just like the Founder. Following Nick's principle: "district admin doesn't need to see anything either really, they can always request data from the teacher." If District Admins genuinely need student data for a specific case (e.g., investigating a complaint), they request it from the teacher who owns it, on the record. This puts the trust posture across DailyWins and TransitionReady on identical architectural footing.

## **Site Admin**

School-level role. Examples: principal, vice principal, dean of students, behavior intervention specialist, transition coordinator. Owns the structure of how teachers at their school work.

**CAN:**

- Create and edit bell schedules for their school (variants, period times, lunch arrangements)

- Invite teachers to their school

- View their school's teacher list

- Deactivate teachers at their school

- View aggregate stats for their school

- View their own teacher dashboard if they also teach (toggle)

- Read audit log entries scoped to their school

- Revoke active magic links generated by teachers at their school (compliance backstop)

**CANNOT:**

- View any specific student's behavior scores or notes (even at their own school)

- View other schools' data

- View other Site Admins' data

**Rationale: **A Site Admin can shape the structure of how teachers work but cannot peer into individual student records. This is a deliberate trust posture: if Site Admins can see student points whenever they want, every teacher's relationship with their admin shifts in subtle, harmful ways. Teachers feel watched. Some game scores upward; others stop scoring. The data gets less honest. Default-no-access protects the teacher's working relationship with the admin. The Site Admin becomes a partner who set up the system, not a boss looking over shoulders.

## **Teacher**

The existing role, refined. Schedules become read-only.

**CAN:**

- View, edit, and score their own students' behavior data

- Write notes (private and shared) on their own students

- Pick from the bell schedules their Site Admin has set up

- Generate magic links for parents and students of their own students

- Revoke their own magic links at any time

- Export PDFs and reports for their own students

**CANNOT:**

- Edit bell schedules (read-only — they pick from Site Admin's list)

- View other teachers' students

- View any students at other schools

- Invite other teachers

- View Site Admin pages

- See audit log entries about themselves (intentional)

**Rationale on audit log opacity: **Teachers cannot see audit entries about themselves. This was a deliberate choice based on the actual workplace dynamics of teaching: teachers operate under more scrutiny than most professions, and giving them a "who's been checking on me?" panel turns mundane database access into a perceived surveillance problem. The audit log exists for compliance accountability, not workplace transparency. Misuse concerns escalate to Site Admin or Founder, not to a self-serve panel.

## **Parents and Students (magic links in v1)**

Parents and students access DailyWins via magic links, not full accounts. A teacher generates a per-student link with parent or student scope; the recipient gets read-only access without login.

This was a deliberate decision to keep the role tiers small and avoid conflating "viewing data" with "having a role in the system." Confirmed in v1.1 review: keep students on magic links for now and prioritize finishing the existing v1 scope before building out The Locker (the student-facing rewards/customization layer that requires student logins).

### **Magic link mechanics (v1.1 spec)**

- Single-use generation tokens; multi-view active links until revoked or expired

- Expiry: end of school year by default, with explicit "refresh link" action available

- Teachers can revoke any link they generated; Site Admins can revoke any link generated by their school's teachers (compliance backstop)

- Every link USE (not just creation) is logged with IP address, User-Agent, and timestamp

- Private notes never appear in parent or student magic-link views, regardless of how the link was generated

**Rationale on IP/UA logging: **If a parent ever disputes whether they actually viewed a report ("I never saw that"), the audit log needs to be able to answer concretely. Without IP/UA capture, magic-link audit trails are half-built.

# **How users join and leave the system**

## **Invitation flow**

Single-use invite links with 14-day expiry. Each tier invites the tier below it:

- Founder invites District Admins

- District Admin invites Site Admins

- Site Admin invites Teachers

- Teachers generate parent/student magic links (different mechanism — read-only, not invite-to-account)

Recipient opens the link, signs in with Google, lands in their role's dashboard. Allowlist updated automatically.

The 14-day expiry handles realistic delays: invite sent Friday afternoon, recipient on vacation, doesn't see it until next weekend. Single-use because compromised links shouldn't keep working.

## **Removal: deactivate, don****'****t delete**

Deactivation removes access without destroying data. The user can't sign in; their historical contributions (scores, notes, invitations issued) remain in the system for audit and continuity.

Permanent deletion is a separate, rare operation reserved for FERPA right-to-be-forgotten requests. It's Founder-only and logged in the audit trail with explicit reason.

## **Migration of the current pilot**

The current 3 users (Devin, Nick, Tommy) all become Founders during migration so they can manage the early system. They each then self-assign Teacher role at their actual schools (Devin and Tommy → PGHS, Nick → COHS). District Admins and Site Admins are invited later when actual people in those roles join the pilot. In the meantime, Founders can wear the schedule-management hat for their own schools.

**Critical: **The interim Founder + Teacher dual-role state is where RLS bugs hide. Phase 2 includes explicit test cases written before migration: "a user with Founder + Teacher should see only their own students," "the user should NOT see all students even though Founder normally has broader access," etc. Verifying this before migrating ourselves.

# **Bell schedules in the database**

Bell schedules move from hardcoded TypeScript constants to a schedules JSONB column on the schools table. The shape is school-keyed, with each variant containing a list of periods and their start/end times. Same shape we use today in the hardcoded constant — just stored per-school in the database instead of globally in code.

**Why JSONB rather than relational tables:**

Schools have idiosyncratic schedule needs (Florin's 8th period, COHS's grad practice, etc.) and a flexible JSON shape lets each school have whatever variants it needs without forcing a fixed schema. The trade-off is harder cross-school queries, which we don't need.

**JSONB validation (v1.1 addition):**

- Zod schema validation on the way in (TypeScript layer) — friendly error messages on the form

- Postgres CHECK constraint as a safety net — can't be bypassed even by a buggy frontend

- Belt and suspenders. Without validation, one malformed Site Admin edit breaks every teacher's dashboard at that school.

The hardcoded TypeScript constant remains in the codebase as a fallback for one or two releases after the migration. After that, it's removed.

The Site Admin UI in v1 supports editing existing variants (rename, change times, add/remove periods) and adding new variants. Templates and cross-school imports are deferred.

# **Act-as: testing and demo capability for Founders**

Founders can "act as" another role to inspect what that role sees. Critically: **view-only**. No writes happen while in act-as mode. To take any action, the Founder exits act-as mode and operates as themselves, where their actions are correctly attributed.

**Why view-only:**

- Test accounts (separate Gmail accounts at different roles) handle write-testing scenarios

- Read-only is dramatically easier to defend in a compliance review than read-write

- "Read-only" is also a much shorter sentence in the privacy policy

Every act-as session is logged in the audit trail with start time, end time, target role, and target user.

This feature pairs with real test accounts at each role. Test accounts do real-user work; act-as is for inspection and demos.

# **Audit logging**

A new audit_log table records:

- **Authentication events: **sign in, sign out, failed sign-in

- **Role/access changes: **invite generated, invite used, role assigned, role deactivated

- **Sensitive operations: **permanent delete, schedule edited, student roster changes, magic link generated, magic link used (with IP and User-Agent), magic link revoked

- **Founder-specific: **act-as session started, act-as session ended

**Not logged (intentional):**

- Every score entered (too noisy, low compliance value)

- Every page view (privacy-invasive, low value)

- Every note read (too noisy)

**Append-only. **No update, no delete, except for FERPA right-to-be-forgotten which is itself a logged event.

**Read access:**

- Founder reads everything

- District Admin reads events scoped to their district

- Site Admin reads events scoped to their school

- Teacher cannot read audit logs

**Retention (v1.1: TBD): **Originally specified 2 years to match typical district records retention. Confirming with EGUSD's CTO during the upcoming meeting whether their actual records-retention policy for student-data-adjacent audit logs requires longer (some districts require 5 or 7 years for FERPA-related material). Locking in then. Cost of holding longer is essentially zero for an append-only structured-event log; cost of deleting too soon is non-recoverable.

# **RLS at the database layer, not application filtering**

Like TransitionReady, every read in DailyWins is gated by Postgres Row Level Security policies that check the requesting user's role and relationship before returning data. Application-layer filtering breaks under bugs; RLS doesn't. A teacher querying for a student outside their roster gets zero rows back from the database, regardless of what the frontend asks for.

This is the architectural commitment that makes the privacy claims defensible.

**Cross-cutting RLS principles:**

- Every read on every table goes through a role-aware policy

- Cross-district isolation is hard: District Admin at District A cannot see District B's data, period

- Cross-school isolation within a district is hard: Site Admin at School A cannot see School B

- Cross-teacher isolation within a school is hard: Teacher A cannot see Teacher B's roster

# **Cross-cutting principles**

- **Default deny. **Any role's permission set is "what they explicitly can do," not "everything except what they can't."

- **Trust posture over feature parity. **Where a privacy decision and a feature richness decision conflict, privacy wins (e.g., admins not seeing student data, teachers not seeing audit logs about themselves).

- **Always demoable. **Each phase merges to main only when complete and shippable. Some phases ship "dark" (no UX change) and are fine.

- **Stable-backup branch tracks last known healthy state. **Updated after each phase ships and verifies live.

- **Staging before production. **RLS-affecting phases tested in a staging environment with realistic data before being applied to production.

# **Build sequence**

The architecture above is significant work — roughly 52–78 hours of careful effort across seven phases. The sequence is designed so each phase leaves the app in a working, demoable state.

### **Phase 1: JSONB schedules migration with validation (~6–8 hours)**

Add schedules JSONB column to schools. Backfill COHS and PGHS. Add Zod schema validation in the application layer plus a Postgres CHECK constraint as a safety net. Update dashboard to read from database with TS constant as fallback.

**Outcome: **Same UX, schedules now live in database with strong validation, third school can be added via SQL.

### **Phase 1.5: Staging environment (~4–6 hours)**

Set up a separate Supabase project that mirrors production schema with anonymized or fake data. Establish workflow for applying migrations to staging first, testing, then applying to production. Required before Phase 2.

**Outcome: **RLS-affecting phases can be tested before they touch production. The highest-risk class of changes (Phase 2) gets a real safety net.

### **Phase 2: Role infrastructure with dual-role test cases (~10–14 hours)**

Add roles and role_assignments tables. Migrate existing 3 users to Founder + Teacher dual roles. Update RLS policies to be role-aware. Write explicit dual-role test cases before migration. District Admin and Site Admin tiers are added as schema entities (no users yet).

**Outcome: **Same UX, but every database query is now role-gated. Ships dark.

### **Phase 3: Invite link infrastructure (~8–12 hours)**

Replace hardcoded allowlist with single-use, 14-day expiry invite links. Tier-by-tier invitations: Founder → District Admin → Site Admin → Teacher. Magic link infrastructure for parents and students includes: token generation, IP/UA logging on use, teacher-and-Site-Admin revocation.

**Outcome: **New users join without code deploys. First real District Admin or Site Admin can be onboarded.

### **Phase 4: Audit log (~6–10 hours)**

New audit_log table. Instrument the events listed above. Build Founder-readable view of full log; District-Admin-readable view scoped to district; Site-Admin-readable view scoped to school. Retention policy locked in once EGUSD weighs in.

**Outcome: **Compliance defense story is solid.

### **Phase 5: Act-as feature (~4–6 hours)**

Founder-only view-only act-as toggle. Audit-logged. Visible UI affordance during act-as sessions.

**Outcome: **Live role-switching demo capability for the EGUSD meeting and beyond.

### **Phase 6: Site Admin schedule editor UI (~10–15 hours)**

Build the UI for Site Admins to add/edit bell schedule variants.

**Outcome: **A real Site Admin can manage their school's schedules without Founder involvement. The bottleneck on schedule maintenance disappears.

**Total: **52–78 hours, spread across 2–4 months at a sustainable pace alongside teaching and life.

Each phase is a real milestone, not just a step. Phase 1 alone solves schedule scaling. Phase 2 alone gives a defensible architecture story. Phase 3 alone makes the system operationally sustainable. There's no era where DailyWins is "broken because it's mid-rebuild" — there's only progressively more capability layered on a stable base.

# **How this answers Nick****'****s six questions (from original review)**

- **Role hierarchy depth: **Four tiers in v1 (Founder, District Admin, Site Admin, Teacher). Both top tiers are structurally PII-blind — matches TransitionReady's commitment.

- **PII isolation at top tiers: **Architecturally enforced via RLS, not policy. The Founder cannot see individual student data. The District Admin also cannot see individual student data — they request it from teachers when needed.

- **Suggest-and-approve pattern: **Not adopted in v1. Teachers directly score and edit their own students; the equivalent of student-approval rights doesn't apply here because there's no student account in v1. (Magic-link student view is read-only.) When DailyWins adds full student accounts (post-Locker), this pattern is worth revisiting.

- **Deletion authority: **Founder-only for permanent deletion, logged in audit trail with reason. Routine "remove this teacher/admin" is a deactivation, available at the appropriate tier.

- **RLS at DB layer vs. app filtering: **RLS at the DB layer for every read, tested in staging before production. Same architectural commitment as TransitionReady.

- **Cross-district / cross-school isolation: **Yes, both layers. RLS keys off district_id and school_id on every read. A District Admin in District A cannot see District B's data. A Site Admin at School A cannot see School B's data within their own district.

# **Strategic positioning (from Nick****'****s v1.1 note)**

Across DailyWins and CORE IEP Tracker, Sure Step Education can credibly say the vendor cannot see student data by database design. SEIS, Frontline, PowerSchool — none of them lead with that. This is a real differentiator and worth its own slide in any district pitch, including the upcoming EGUSD conversation.

# **What****'****s NOT in this doc**

This doc is the v1 architecture and build plan. It does not cover:

- Full Student/Parent accounts (deferred until after v1 ships and The Locker work begins)

- The Locker itself (post-v1, requires student logins, separate design conversation)

- Cross-product integration with TransitionReady (separate conversation; would build on this foundation)

- Compliance posture document (DPAs, AB 1584 templates, Anthropic API usage with student data — those are separate workstreams)

- The EGUSD superintendent meeting strategy

These are real questions that deserve real attention in their own time. They're not in scope for this doc.
