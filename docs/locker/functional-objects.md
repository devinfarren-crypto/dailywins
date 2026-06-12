# The Locker — Functional Objects

*Drafted 2026-06-12. Decorations make it theirs; functional objects make it
useful — the difference between a locker opened weekly and one opened daily.
Ranked by mission-alignment and risk; the first two ship now.*

## Shipping now

**1. Today card (`crd-today`)** — an index card showing the student's real
periods for today, resolved from the school's bell schedule (specific-date
variant wins, then day-of-week match, then first variant). The current
period is highlighted live. Free, granted to everyone, placeable/movable/
resizable like any object. Zero new data, zero risk — and a reason to open
the locker every morning.

**2. Goal card (`crd-goal`)** — the student picks ONE behavior category as
their goal; the card fills itself in from the points they're already earning
this week (Mon–today, their teacher's scoring). Progress bar + "14/15 this
week." Free, granted to everyone. The goal choice lives in the layout JSON
(`layout.goal.category`) — changing it is a selection-pill action, no new
tables. **This is the product thesis closing into a loop: the locker gives
students a reason to care about the behavior record.**

**3. Proud-work showcase (`crd-work`)** — SHIPPED 2026-06-12. Paste a Google
Doc/Slide link → gold-star paper on the door. Guardrails as specced:
server-enforced URL allowlist (`WORK_URL_HOSTS` in schema.ts — docs.google.com
+ drive.google.com, https only, re-checked on every layout save) and PRESET
captions (`WORK_CAPTIONS`, chosen by index) — never free text. Pointer lives
in `layout.work {url, caption}`; Google's sharing permissions decide who can
open it. "Open ↗" pill opens in a new tab.

## Next (specced, not built)

**4. Countdown card** — teacher sets it per class ("14 days until break").
Trivial; beloved.

**5. Progress printout** — the student's weekly chart as a paper pinned
inside the door. Pure rendering of existing data.

**6. Sticky notes to self** — private free text, student-only visibility.
Sequenced AFTER the school visibility-toggle ships (first true free-text
surface).

## Explicitly not building

- **Assignment agenda/planner** — duplicates Google Classroom/Canvas; an
  out-of-date agenda is worse than none. We're the locker, not the LMS.
- **Photo uploads** — unchanged from locker-spec.md.

## Mechanics note

Cards are catalog items (`type: "card"`, prefix `crd-`, price 0, starter)
that render as LIVE components instead of images — they inherit every
existing mechanic (place, drag, layer, rotate, resize, shoebox) for free.
Card data rides the existing `/api/locker/state` response; nothing new is
writable by the student except their goal choice.
