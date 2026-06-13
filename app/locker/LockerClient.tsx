"use client";

// The Locker canvas: place / drag / layer / rotate items on the inside of
// your locker door, with the Shoebox (inventory), Store, and Bank as
// slide-over sheets. Dark-mode register (decision #1: exempt from the Sure
// Step system); Chromebook rules from ui-plan.md: transform-only dragging,
// rAF-throttled moves, opaque assets, 30-item cap, keyboard path for every
// drag action.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CATALOG,
  CATALOG_BY_ID,
  GOAL_TARGETS,
  PACK_NAMES,
  WORK_CAPTIONS,
  isAllowedWorkUrl,
  type CatalogItem,
  type LockerLayout,
  type PlacedItem,
} from "@/src/lib/locker/schema";
import { SHELF_TEMPLATE_BY_ID, type ShelfItem } from "@/src/lib/locker/shelf";

const INK = "#0f1118";
const PANEL = "#161924";
const PANEL2 = "#1c2030";
const EDGE = "#262b3a";
const TEXT = "#e7e9f0";
const MUTED = "#9aa1b5";
const ACCENT = "#5ad0a2";
const ACCENT_DARK = "#0c8f63";
const WARN = "#ff9d8a";

interface LockerState {
  displayName: string;
  balance: number;
  earnedAllTime: number;
  ledger: { id: string; entry_type: string; amount: number; ref: Record<string, unknown>; created_at: string }[];
  inventory: string[];
  layout: LockerLayout;
  weekProgress: { id: string; name: string; earned: number; possible: number }[];
  shelf: ShelfItem[];
}

type Sheet =
  | null
  | "shoebox"
  | "store"
  | "bank"
  | "goal"
  | "work"
  | "calendar"
  | { confirm: CatalogItem }
  | { shelfDetail: ShelfItem };

type CalMark = "done" | "off";

// One YYYY-MM-DD in the student's local time (the locker is client-rendered).
function localISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Display size (fraction of CANVAS width) per item type. The canvas is the
// whole open locker (door + cavity), so these are roughly half the old
// door-only values to keep items the same physical size.
const SIZE: Record<CatalogItem["type"], number> = {
  sticker: 0.115,
  button: 0.085,
  patch: 0.135,
  magnet: 0.07,
  mirror: 0.15,
  card: 0.17,
  background: 0,
};

export default function LockerClient() {
  const [state, setState] = useState<LockerState | null>(null);
  const [error, setError] = useState("");
  const [layout, setLayout] = useState<LockerLayout>({ items: [], background: null });
  const [selected, setSelected] = useState<number | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toast, setToast] = useState("");
  const [justPlaced, setJustPlaced] = useState<number | null>(null);
  const [settling, setSettling] = useState<number | null>(null);
  // The entry ritual: every visit starts at the CLOSED door; tapping it (or
  // arriving fresh from the combo) swings it open slowly, like a real locker.
  const [doorPhase, setDoorPhase] = useState<"closed" | "opening" | "open">(() => {
    if (typeof window === "undefined") return "closed";
    try {
      if (sessionStorage.getItem("dw-locker-fresh") === "1") {
        sessionStorage.removeItem("dw-locker-fresh");
        return "opening"; // combo just succeeded — the door opens itself
      }
    } catch {
      /* privacy mode */
    }
    return "closed";
  });
  useEffect(() => {
    if (doorPhase !== "opening") return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t = setTimeout(() => setDoorPhase("open"), reduced ? 50 : 1150);
    return () => clearTimeout(t);
  }, [doorPhase]);
  const doorRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ idx: number; startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const layoutRef = useRef(layout);
  layoutRef.current = layout;

  // ── data ──────────────────────────────────────────────────────────────────
  const refresh = useCallback(async () => {
    const res = await fetch("/api/locker/state");
    if (!res.ok) {
      setError("Couldn't open your locker. Try your class link again.");
      return;
    }
    const data = await res.json();
    setState(data);
    // Legacy migrations (persist on the next save): the old single
    // layout.work slot moves onto the first placed work card, and placed
    // copies of the retired Today card disappear (the Month card replaced it).
    let lay = data.layout as LockerLayout;
    if (lay.work) {
      const i = lay.items.findIndex((p) => p.item_id === "crd-work" && !p.work);
      if (i >= 0) {
        lay = { ...lay, items: lay.items.map((p, j) => (j === i ? { ...p, work: lay.work! } : p)), work: null };
      }
    }
    if (lay.items.some((p) => p.item_id === "crd-today")) {
      lay = { ...lay, items: lay.items.filter((p) => p.item_id !== "crd-today") };
    }
    setLayout(lay);
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  // Save is last-write-wins and fire-and-forget. The locker is ONE student on
  // their own device, so the client is the source of truth for the whole
  // session — we never refetch and overwrite the layout mid-session (doing so
  // on window-focus used to revert in-progress edits). Chained so writes land
  // in order; a failed write just retries on the next edit.
  const saveChain = useRef<Promise<void>>(Promise.resolve());
  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null;
      saveChain.current = saveChain.current.then(async () => {
        try {
          await fetch("/api/locker/layout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ layout: layoutRef.current }),
            keepalive: true,
          });
        } catch {
          /* offline blip — the next edit retries with current state */
        }
      });
    }, 600);
  }, []);

  const mutateLayout = useCallback(
    (fn: (l: LockerLayout) => LockerLayout) => {
      setLayout((prev) => {
        const next = fn(prev);
        layoutRef.current = next;
        return next;
      });
      scheduleSave();
    },
    [scheduleSave]
  );

  // ── derived ───────────────────────────────────────────────────────────────
  const placedIds = useMemo(() => new Set(layout.items.map((p) => p.item_id)), [layout]);
  const shoebox = useMemo(
    () =>
      (state?.inventory ?? [])
        .map((id) => CATALOG_BY_ID.get(id))
        .filter((i): i is CatalogItem => Boolean(i))
        // crd-work never leaves the Shoebox: place one, a fresh blank one is
        // already waiting — students can show off as many works as they like.
        // Retired items (e.g. the old Today card) stay granted but hidden.
        .filter((i) => !i.retired && i.type !== "background" && (!placedIds.has(i.id) || i.id === "crd-work")),
    [state, placedIds]
  );
  const ownedBackgrounds = useMemo(
    () =>
      (state?.inventory ?? [])
        .map((id) => CATALOG_BY_ID.get(id))
        .filter((i): i is CatalogItem => Boolean(i) && i!.type === "background"),
    [state]
  );
  const bg = layout.background ? CATALOG_BY_ID.get(layout.background) : null;

  // ── actions ───────────────────────────────────────────────────────────────
  const placeItem = (item: CatalogItem) => {
    if (layout.items.length >= 40) {
      setToast("Your locker's full — put something in the shoebox first.");
      return;
    }
    if (item.type === "mirror" && layout.items.some((p) => CATALOG_BY_ID.get(p.item_id)?.type === "mirror")) {
      setToast("One mirror per locker — that's the rule of cool.");
      return;
    }
    const maxZ = layout.items.reduce((m, p) => Math.max(m, p.z), 0);
    const newIdx = layout.items.length;
    mutateLayout((l) => ({
      ...l,
      items: [
        ...l.items,
        { item_id: item.id, x: 0.5 + (Math.random() - 0.5) * 0.1, y: 0.42 + (Math.random() - 0.5) * 0.1, z: maxZ + 1, rot: Math.round((Math.random() - 0.5) * 8) },
      ],
    }));
    setSelected(newIdx);
    setJustPlaced(newIdx);
    setTimeout(() => setJustPlaced(null), 260);
    setSheet(null);
  };

  const putAway = (idx: number) => {
    mutateLayout((l) => ({ ...l, items: l.items.filter((_, i) => i !== idx) }));
    setSelected(null);
  };

  const nudgeZ = (idx: number, dir: 1 | -1) =>
    mutateLayout((l) => {
      const items = l.items.map((p, i) => (i === idx ? { ...p, z: Math.max(0, Math.min(99, p.z + dir)) } : p));
      return { ...l, items };
    });

  const rotate = (idx: number, deg: number) =>
    mutateLayout((l) => ({
      ...l,
      items: l.items.map((p, i) =>
        i === idx ? { ...p, rot: Math.max(-45, Math.min(45, p.rot + deg)) } : p
      ),
    }));

  const resize = (idx: number, factor: number) =>
    mutateLayout((l) => ({
      ...l,
      items: l.items.map((p, i) =>
        i === idx
          ? { ...p, scale: Math.max(0.5, Math.min(2, (p.scale ?? 1) * factor)) }
          : p
      ),
    }));

  const nudgeXY = (idx: number, dx: number, dy: number) =>
    mutateLayout((l) => ({
      ...l,
      items: l.items.map((p, i) =>
        i === idx
          ? { ...p, x: clamp(p.x + dx), y: clamp(p.y + dy) }
          : p
      ),
    }));

  // Month card: tap a day to cycle blank → done → no-school → blank. Old
  // months are pruned on every edit so the marks record never grows past
  // this month + last month (the schema's 80-key cap is just the backstop).
  const cycleCalMark = (date: string) =>
    mutateLayout((l) => {
      const marks = { ...(l.calendar?.marks ?? {}) } as Record<string, CalMark>;
      const cur = marks[date];
      if (!cur) marks[date] = "done";
      else if (cur === "done") marks[date] = "off";
      else delete marks[date];
      const now = new Date();
      const floor = localISO(new Date(now.getFullYear(), now.getMonth() - 1, 1));
      for (const k of Object.keys(marks)) if (k < floor) delete marks[k];
      return { ...l, calendar: { marks } };
    });

  const buy = async (item: CatalogItem) => {
    const res = await fetch("/api/locker/purchase", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: item.id }),
    });
    const data = await res.json();
    if (!data.ok) {
      setToast(
        data.error === "insufficient_funds"
          ? `Not yet — you have ${data.balance}. Earn ${item.price - data.balance} more.`
          : data.error === "already_owned"
            ? "Already in your shoebox."
            : "Purchase failed. Try again."
      );
      setSheet("store");
      return;
    }
    setToast(`${item.name} is yours.`);
    await refresh();
    setSheet("shoebox");
  };

  // ── drag (pointer events, transform-only) ─────────────────────────────────
  const onPointerDown = (e: React.PointerEvent, idx: number) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setSelected(idx);
    const p = layout.items[idx];
    dragRef.current = { idx, startX: e.clientX, startY: e.clientY, origX: p.x, origY: p.y, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    const door = doorRef.current;
    if (!d || !door) return;
    const rect = door.getBoundingClientRect();
    const nx = clamp(d.origX + (e.clientX - d.startX) / rect.width);
    const ny = clamp(d.origY + (e.clientY - d.startY) / rect.height);
    d.moved = true;
    // Drag lives in state but throttles via rAF naturally at classroom scale;
    // commit-to-server happens on pointerup via scheduleSave.
    setLayout((l) => ({
      ...l,
      items: l.items.map((p, i) => (i === d.idx ? { ...p, x: nx, y: ny } : p)),
    }));
  };
  const onPointerUp = () => {
    if (dragRef.current?.moved) {
      scheduleSave();
      const idx = dragRef.current.idx;
      setSettling(idx);
      setTimeout(() => setSettling(null), 150);
    }
    dragRef.current = null;
  };

  // keyboard path for the selected item (ui-plan accessibility rule)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (selected === null) return;
      const step = e.shiftKey ? 0.05 : 0.012;
      if (e.key === "ArrowLeft") nudgeXY(selected, -step, 0);
      else if (e.key === "ArrowRight") nudgeXY(selected, step, 0);
      else if (e.key === "ArrowUp") nudgeXY(selected, 0, -step);
      else if (e.key === "ArrowDown") nudgeXY(selected, 0, step);
      else if (e.key === "[") nudgeZ(selected, -1);
      else if (e.key === "]") nudgeZ(selected, 1);
      else if (e.key === "r") rotate(selected, e.shiftKey ? -7 : 7);
      else if (e.key === "+" || e.key === "=") resize(selected, 1.12);
      else if (e.key === "-") resize(selected, 1 / 1.12);
      else if (e.key === "Escape") setSelected(null);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  // "Something new on your shelf" — one soft cue per item, then mark it seen
  // so the glow never repeats. The ref guards against refresh() re-firing it.
  const seenHandled = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!state || doorPhase !== "open") return;
    const unseen = (state.shelf ?? []).filter((s) => !s.seen && !seenHandled.current.has(s.id));
    if (unseen.length === 0) return;
    unseen.forEach((s) => seenHandled.current.add(s.id));
    setToast(unseen.length === 1 ? "Something new on your shelf ✨" : `${unseen.length} new things on your shelf ✨`);
    const t = setTimeout(() => {
      unseen.forEach((s) =>
        fetch("/api/locker/shelf", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: s.id, action: "seen" }),
        })
      );
    }, 4000);
    return () => clearTimeout(t);
  }, [state, doorPhase]);

  const redeemShelfItem = async (item: ShelfItem) => {
    const res = await fetch("/api/locker/shelf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: item.id, action: "use" }),
    });
    const data = await res.json().catch(() => null);
    if (!data?.ok) {
      setToast("Couldn't raise your hand — try again.");
      return;
    }
    setToast("Hand raised! Your teacher will confirm.");
    setSheet(null);
    await refresh();
  };

  // While a sheet is open, the page behind must not move at all — scrolling
  // past the sheet's end was chaining into the locker and "dragging" it.
  useEffect(() => {
    if (sheet) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [sheet]);

  if (error) return <Centered>{error}</Centered>;
  if (!state) return <Centered>Opening your locker…</Centered>;

  // The closed door now lives ON the open-locker canvas as a single cover that
  // swings open (see DoorCover, below the canvas) — one object, one size, one
  // hinge, so the open never "jumps" to a different locker. No early return.
  const doorOpen = doorPhase === "open";

  return (
    <main
      style={{
        // Everything fits in one viewport — no page scroll, ever. The door
        // sizes to whatever height remains after the top bar and hint row.
        height: "100dvh",
        overflow: "hidden",
        background: `radial-gradient(90% 70% at 50% 0%, #171b28 0%, ${INK} 65%)`,
        fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
        color: TEXT,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <style>{`
        button { font-family: inherit; }
        .lk-chip:focus-visible, .lk-item:focus-visible, button:focus-visible { outline: 3px solid ${ACCENT}; outline-offset: 2px; }
        .lk-item { touch-action: none; user-select: none; -webkit-user-drag: none; }
        @keyframes lkSheetUp { from { transform: translateY(28px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @keyframes lkFadeIn { from { opacity: 0 } to { opacity: 1 } }
        .lk-sheet { animation: lkSheetUp .22s cubic-bezier(.22,1,.36,1) both; }
        .lk-backdrop { animation: lkFadeIn .18s ease both; }
        /* juice — all ≤250ms, transform/opacity only */
        @keyframes lkSlap { from { scale: 1.14 } to { scale: 1 } }
        @keyframes lkSettle { from { scale: 1.045 } to { scale: 1 } }
        @keyframes lkPop { from { transform: translateY(8px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @keyframes lkSheen { from { transform: translateX(-130%) } to { transform: translateX(130%) } }
        .lk-slap { animation: lkSlap .18s cubic-bezier(.2,1.4,.4,1) both; }
        .lk-settle { animation: lkSettle .12s ease-out both; }
        .lk-cell { animation: lkPop .18s ease both; }
        .lk-sheen { position: absolute; inset: -10%; overflow: hidden; pointer-events: none; border-radius: 50%; }
        .lk-sheen::after { content: ""; position: absolute; top: 0; bottom: 0; width: 45%;
          background: linear-gradient(105deg, transparent, rgba(255,255,255,.55), transparent);
          animation: lkSheen .6s ease .05s both; }
        /* new-on-your-shelf glow — a few warm pulses, then quiet forever */
        @keyframes lkGlow { 0%, 100% { filter: drop-shadow(0 3px 2px rgba(0,0,0,.5)) } 50% { filter: drop-shadow(0 0 12px rgba(240,182,71,.95)) } }
        .lk-fresh { animation: lkGlow 1.5s ease-in-out 4; }
        /* the door cover swings open on its LEFT hinge to reveal the locker
           behind it — one object, same size, never replaced by a different one */
        @keyframes lkCoverOpen {
          0%   { transform: perspective(1500px) rotateY(0deg); }
          100% { transform: perspective(1500px) rotateY(-104deg); opacity: .15 }
        }
        .lk-cover { transform-origin: left center; backface-visibility: hidden; }
        .lk-cover-open { animation: lkCoverOpen 1.15s cubic-bezier(.45,.05,.35,1) both; pointer-events: none; }
        @media (prefers-reduced-motion: reduce) { .lk-cover-open { animation: none !important; opacity: 0 !important; } }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
      `}</style>

      {/* top bar — always reserves its height so the canvas never shifts
          position when the door opens; its contents just fade in once open. */}
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px",
          boxSizing: "border-box",
          opacity: doorOpen ? 1 : 0,
          pointerEvents: doorOpen ? "auto" : "none",
          transition: "opacity .35s ease .15s",
        }}
      >
        <div>
          <div style={{ fontSize: 11, letterSpacing: "0.16em", color: MUTED, textTransform: "uppercase", fontWeight: 700 }}>
            Your locker
          </div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>{state.displayName}</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Chip onClick={() => setSheet("bank")} label={`◉ ${state.balance}`} title="Bank" active={sheet === "bank"} />
          <Chip onClick={() => setSheet("store")} label="Store" active={sheet === "store"} />
          <Chip onClick={() => setSheet("shoebox")} label={`Shoebox${shoebox.length ? ` · ${shoebox.length}` : ""}`} active={sheet === "shoebox"} />
          <Chip onClick={() => { setSheet(null); setSelected(null); setDoorPhase("closed"); }} label="Shut" title="Close your locker" />
        </div>
      </div>

      {/* the door */}
      <div
        ref={doorRef}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerDown={(e) => {
          if (e.target === doorRef.current) setSelected(null);
        }}
        style={{
          position: "relative",
          // The whole OPEN locker is one canvas: the door (left, hinged) and
          // the cavity (right) — every inch decoratable. Width also capped by
          // remaining height so it always fits one viewport.
          width: "min(94vw, 760px, calc((100dvh - 150px) * 15 / 11))",
          aspectRatio: "15 / 11",
          borderRadius: 12,
          border: "8px solid #20242f",
          boxShadow: "inset 0 0 0 2px #0a0c12, 0 30px 70px rgba(0,0,0,.55)",
          // Clip stickers to the frame when open; let the door swing past the
          // frame freely while it's opening so the 3-D hinge isn't sheared off.
          overflow: doorOpen ? "hidden" : "visible",
          backgroundColor: "#2a3a55",
          backgroundImage: bg ? `url(${bg.asset})` : "url(/locker/backgrounds/bg-navy-paint.svg)",
          backgroundSize: "cover",
        }}
      >
        {/* ── the physical locker, drawn under the stickers ─────────────── */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {/* sheet-metal material: brushed verticals + one shared noise tile */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "repeating-linear-gradient(90deg, transparent 0 2px, rgba(255,255,255,.015) 2px 3px, rgba(0,0,0,.025) 3px 4px), url(/locker/textures/noise.svg)",
            }}
          />
          {/* recessed door panel (embossed metal) */}
          <div style={{ position: "absolute", left: "5%", top: "12%", bottom: "5%", width: "37%", borderRadius: 8, boxShadow: "inset 2px 2px 4px rgba(0,0,0,.28), inset -1px -1px 2px rgba(255,255,255,.07)" }} />
          {/* door panel shading (left half) — inside of the open door */}
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "47%", boxShadow: "inset -18px 0 28px -18px rgba(0,0,0,.55), inset 4px 0 10px -4px rgba(255,255,255,.06)" }} />
          {/* door vents */}
          <div style={{ position: "absolute", top: "4%", left: "23.5%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", gap: 6, opacity: 0.85 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ width: "min(110px, 14vw)", height: 6, borderRadius: 3, background: "rgba(0,0,0,.45)", boxShadow: "inset 0 2px 3px rgba(0,0,0,.8), 0 1px 0 rgba(255,255,255,.08)" }} />
            ))}
          </div>
          {/* door latch (outer edge) with screw heads */}
          <div style={{ position: "absolute", left: "1.5%", top: "44%", width: 10, height: "9%", borderRadius: 4, background: "linear-gradient(90deg, #3a4152, #1c2029)", boxShadow: "0 2px 4px rgba(0,0,0,.5)" }}>
            <div style={{ position: "absolute", top: 3, left: 3, width: 4, height: 4, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%, #6a7388, #20242f)" }} />
            <div style={{ position: "absolute", bottom: 3, left: 3, width: 4, height: 4, borderRadius: "50%", background: "radial-gradient(circle at 35% 35%, #6a7388, #20242f)" }} />
          </div>
          {/* hinge strip between door and cavity */}
          <div style={{ position: "absolute", left: "47%", top: 0, bottom: 0, width: "2.4%", background: "linear-gradient(90deg, #11141c, #2c3242 45%, #11141c)", boxShadow: "0 0 10px rgba(0,0,0,.6)" }}>
            {[0.12, 0.45, 0.78].map((t) => (
              <div key={t} style={{ position: "absolute", top: `${t * 100}%`, left: "-22%", width: "144%", height: "7%", borderRadius: 4, background: "linear-gradient(180deg, #454d61, #20242f)", boxShadow: "0 2px 3px rgba(0,0,0,.55)" }} />
            ))}
          </div>
          {/* cavity (right) — deeper, darker, with a shelf */}
          <div style={{ position: "absolute", left: "49.4%", top: 0, bottom: 0, right: 0, boxShadow: "inset 22px 12px 44px rgba(0,0,0,.55), inset -10px -16px 34px rgba(0,0,0,.45)" }} />
          {/* shelf */}
          <div style={{ position: "absolute", left: "50.5%", right: "1%", top: "26%", height: 7, borderRadius: 2, background: "linear-gradient(180deg, rgba(255,255,255,.16), rgba(0,0,0,.35))", boxShadow: "0 6px 12px rgba(0,0,0,.45)" }} />
          {/* cavity floor shadow */}
          <div style={{ position: "absolute", left: "49.4%", right: 0, bottom: 0, height: "7%", background: "linear-gradient(180deg, transparent, rgba(0,0,0,.5))" }} />
        </div>

        {/* inspiration ghosts — only while the locker is empty */}
        {layout.items.length === 0 ? (
          <div aria-hidden="true" style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
            {[
              { x: "16%", y: "26%", w: "11%", r: -8 },
              { x: "30%", y: "52%", w: "13%", r: 6 },
              { x: "12%", y: "70%", w: "9%", r: 12 },
              { x: "66%", y: "44%", w: "12%", r: -5 },
              { x: "80%", y: "70%", w: "10%", r: 8 },
            ].map((g, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: g.x,
                  top: g.y,
                  width: g.w,
                  aspectRatio: "1",
                  borderRadius: "50%",
                  border: "2.5px dashed rgba(255,255,255,.28)",
                  transform: `rotate(${g.r}deg)`,
                }}
              />
            ))}
          </div>
        ) : null}

        {layout.items.map((p, idx) => (
          <Placed
            key={`${p.item_id}-${idx}`}
            placed={p}
            idx={idx}
            selected={selected === idx}
            slap={justPlaced === idx}
            settle={settling === idx}
            live={{
              weekProgress: state.weekProgress,
              goalCategory: layout.goal?.category ?? null,
              goalTarget: layout.goal?.target ?? 80,
              calendarMarks: layout.calendar?.marks ?? {},
            }}
            onPointerDown={onPointerDown}
          />
        ))}

        {/* teacher shelf objects — the one surface the student doesn't
            control. First five sit on the shelf; overflow rests on the
            cavity floor. Tap → detail sheet → "Use this". */}
        {(state.shelf ?? []).map((s, i) => (
          <ShelfObject key={s.id} item={s} index={i} fresh={!s.seen} onOpen={() => setSheet({ shelfDetail: s })} />
        ))}

        {/* ── the door COVER — same canvas, same size; swings open on the left
            hinge to reveal everything above. Tapping (or arriving fresh from
            the combo) starts the swing; after 1.15s doorPhase flips to "open"
            and this unmounts. This is THE single locker opening. ──────────── */}
        {!doorOpen ? (
          <button
            className={`lk-cover${doorPhase === "opening" ? " lk-cover-open" : ""}`}
            onClick={() => doorPhase === "closed" && setDoorPhase("opening")}
            aria-label="Open your locker"
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 55,
              border: "none",
              borderRadius: 6,
              padding: 0,
              cursor: doorPhase === "closed" ? "pointer" : "default",
              background: "linear-gradient(180deg, #2e3950, #232c40)",
              backgroundImage: "url(/locker/textures/noise.svg)",
              boxShadow: "inset 0 0 0 2px #0a0c12, 0 24px 60px rgba(0,0,0,.55)",
            }}
          >
            {/* vents */}
            <div style={{ position: "absolute", top: "13%", left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", gap: 6 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ width: "min(150px, 20vw)", height: 6, borderRadius: 3, background: "rgba(0,0,0,.5)", boxShadow: "inset 0 2px 3px rgba(0,0,0,.8), 0 1px 0 rgba(255,255,255,.08)" }} />
              ))}
            </div>
            {/* name plate */}
            <div style={{ position: "absolute", top: "29%", left: "50%", transform: "translateX(-50%)", background: "#e8e2d0", color: "#2c3440", borderRadius: 3, padding: "4px 14px", fontSize: 13, fontWeight: 800, whiteSpace: "nowrap", maxWidth: "70%", overflow: "hidden", textOverflow: "ellipsis" }}>
              {state.displayName}
            </div>
            {/* dial */}
            <div style={{ position: "absolute", top: "55%", left: "50%", transform: "translate(-50%, -50%)", width: "16%", aspectRatio: "1", borderRadius: "50%", background: "radial-gradient(circle at 38% 32%, #3a4156, #1d212e)", border: "4px solid #3a4156", boxShadow: "inset 0 3px 10px rgba(0,0,0,.7), 0 3px 8px rgba(0,0,0,.4)" }}>
              <div style={{ position: "absolute", top: 4, left: "50%", width: 3, height: 11, marginLeft: -1.5, background: ACCENT, borderRadius: 2 }} />
            </div>
            {/* handle (right edge — opposite the hinge) */}
            <div style={{ position: "absolute", right: "4%", top: "50%", transform: "translateY(-50%)", width: 12, height: "26%", borderRadius: 6, background: "linear-gradient(90deg, #3a4152, #1c2029)", boxShadow: "0 2px 4px rgba(0,0,0,.5)" }} />
            {/* hint */}
            <div style={{ position: "absolute", bottom: "9%", left: 0, right: 0, textAlign: "center", fontSize: 13, fontWeight: 800, color: "rgba(255,255,255,.82)", opacity: doorPhase === "opening" ? 0 : 1, transition: "opacity .25s" }}>
              Tap to open
            </div>
          </button>
        ) : null}
      </div>

      {/* selection controls — fixed-height slot so nothing pushes past the
          viewport. Empty until the door is open (keeps the layout stable). */}
      <div style={{ height: 58, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: doorOpen ? 1 : 0, transition: "opacity .35s ease .15s" }}>
        {!doorOpen ? null : selected !== null && layout.items[selected] ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            {layout.items[selected]?.item_id === "crd-goal" && state.weekProgress.length > 0 ? (
              <Pill onClick={() => setSheet("goal")} label="🎯 Set my goal" />
            ) : null}
            {layout.items[selected]?.item_id === "crd-work" ? (
              <>
                <Pill onClick={() => setSheet("work")} label="✏️ Set my work" />
                {layout.items[selected]?.work?.url ? (
                  <Pill
                    onClick={() => window.open(layout.items[selected]?.work?.url, "_blank", "noopener,noreferrer")}
                    label="Open ↗"
                  />
                ) : null}
              </>
            ) : null}
            {layout.items[selected]?.item_id === "crd-month" ? (
              <Pill onClick={() => setSheet("calendar")} label="📅 Edit calendar" />
            ) : null}
            <Pill onClick={() => resize(selected, 1.15)} label="＋ Bigger" />
            <Pill onClick={() => resize(selected, 1 / 1.15)} label="－ Smaller" />
            <Pill onClick={() => nudgeZ(selected, 1)} label="Forward" />
            <Pill onClick={() => nudgeZ(selected, -1)} label="Back" />
            <Pill onClick={() => rotate(selected, 7)} label="⟳" />
            <Pill onClick={() => rotate(selected, -7)} label="⟲" />
            <Pill onClick={() => putAway(selected)} label="Put away" warn />
          </div>
        ) : (
          <p style={{ color: "#6b7288", fontSize: 12, margin: 0 }}>
            {layout.items.length === 0
              ? "Empty locker. Open the Shoebox and make it yours."
              : "Tap a sticker to move, layer, or rotate it · Shoebox holds the rest"}
          </p>
        )}
      </div>

      {toast ? (
        <div
          role="status"
          style={{
            position: "fixed",
            bottom: 22,
            left: "50%",
            transform: "translateX(-50%)",
            background: PANEL2,
            border: `1px solid ${EDGE}`,
            color: TEXT,
            padding: "10px 18px",
            borderRadius: 999,
            fontSize: 13.5,
            fontWeight: 600,
            boxShadow: "0 10px 30px rgba(0,0,0,.5)",
            zIndex: 60,
          }}
        >
          {toast}
        </div>
      ) : null}

      {/* sheets */}
      {sheet === "shoebox" ? (
        <SheetFrame title="Shoebox" subtitle="Your stuff — tap to put it on the door" onClose={() => setSheet(null)}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(86px, 1fr))", gap: 10 }}>
            {shoebox.length === 0 ? (
              <p style={{ color: MUTED, fontSize: 13, gridColumn: "1/-1" }}>
                Everything you own is on the door. The Store has more.
              </p>
            ) : (
              shoebox.map((item, i) => (
                <button
                  key={item.id}
                  className="lk-cell"
                  onClick={() => placeItem(item)}
                  style={{ ...cellStyle, animationDelay: `${Math.min(i, 10) * 22}ms` }}
                  aria-label={`Place ${item.name}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.asset} alt="" loading="lazy" style={{ width: 52, height: 52, objectFit: "contain" }} />
                  <span style={{ fontSize: 11, color: MUTED }}>{item.name}</span>
                  {item.id === "crd-work" ? (
                    <span style={{ fontSize: 9.5, color: ACCENT, fontWeight: 700 }}>∞ always more</span>
                  ) : null}
                </button>
              ))
            )}
          </div>
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.14em", color: MUTED, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>
              Door paint & wallpaper
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              {ownedBackgrounds.map((b) => (
                <button
                  key={b.id}
                  onClick={() => mutateLayout((l) => ({ ...l, background: b.id }))}
                  aria-label={`Use background ${b.name}`}
                  style={{
                    width: 56,
                    height: 74,
                    borderRadius: 8,
                    border: layout.background === b.id ? `3px solid ${ACCENT}` : `1px solid ${EDGE}`,
                    backgroundImage: `url(${b.asset})`,
                    backgroundSize: "cover",
                    cursor: "pointer",
                  }}
                />
              ))}
            </div>
          </div>
        </SheetFrame>
      ) : null}

      {sheet === "store" ? (
        <SheetFrame title="Store" subtitle={`Posted prices, no surprises · you have ◉ ${state.balance}`} onClose={() => setSheet(null)}>
          {Object.entries(PACK_NAMES).map(([slug, packName]) => {
            const items = CATALOG.items.filter((i) => i.pack === slug && i.price > 0 && !i.retired);
            if (items.length === 0) return null;
            const ownedCount = items.filter((i) => state.inventory.includes(i.id)).length;
            // Backgrounds last within a pack; foil/holo bubble to the end too.
            const rank = (i: CatalogItem) =>
              (i.type === "background" ? 100 : 0) + (i.rarity === "holo" ? 2 : i.rarity === "foil" ? 1 : 0);
            const sorted = [...items].sort((a, b) => rank(a) - rank(b) || a.price - b.price);
            return (
              <div key={slug} style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 12, letterSpacing: "0.14em", color: TEXT, textTransform: "uppercase", fontWeight: 800 }}>
                    {packName}
                  </span>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: ownedCount === items.length ? "#08110d" : MUTED,
                      background: ownedCount === items.length ? ACCENT : PANEL,
                      border: `1px solid ${ownedCount === items.length ? ACCENT : EDGE}`,
                      borderRadius: 999,
                      padding: "2px 9px",
                    }}
                  >
                    {ownedCount === items.length ? "Complete ✓" : `${ownedCount}/${items.length} collected`}
                  </span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 10 }}>
                  {sorted.map((item, i) => {
                    const owned = state.inventory.includes(item.id);
                    const rare = item.rarity !== "common";
                    const rareColor = item.rarity === "holo" ? "#C6A4FF" : "#E8D48B";
                    return (
                      <button
                        key={item.id}
                        className="lk-cell"
                        onClick={() => !owned && setSheet({ confirm: item })}
                        disabled={owned}
                        style={{
                          ...cellStyle,
                          opacity: owned ? 0.55 : 1,
                          animationDelay: `${Math.min(i, 10) * 22}ms`,
                          ...(rare ? { borderColor: `${rareColor}55` } : {}),
                        }}
                        aria-label={owned ? `${item.name} — owned` : `Buy ${item.name} for ${item.price} points`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.asset} alt="" loading="lazy" style={{ width: 52, height: 52, objectFit: "contain" }} />
                        <span style={{ fontSize: 11.5, color: TEXT, fontWeight: 600 }}>{item.name}</span>
                        <span style={{ fontSize: 11, color: owned ? MUTED : rare ? rareColor : ACCENT, fontWeight: 700 }}>
                          {owned ? "Owned" : `${rare ? `${item.rarity.toUpperCase()} · ` : ""}◉ ${item.price}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </SheetFrame>
      ) : null}

      {sheet === "bank" ? (
        <SheetFrame title="Bank" subtitle="Spending never touches your behavior record" onClose={() => setSheet(null)}>
          <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
            <StatBox label="In wallet" value={`◉ ${state.balance}`} />
            <StatBox label="Earned all-time" value={`◉ ${state.earnedAllTime}`} />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {state.ledger.map((row) => (
              <div
                key={row.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  background: PANEL,
                  border: `1px solid ${EDGE}`,
                  borderRadius: 10,
                  padding: "9px 12px",
                  fontSize: 12.5,
                }}
              >
                <span style={{ color: MUTED }}>{ledgerLabel(row)}</span>
                <span style={{ fontWeight: 800, color: row.amount > 0 ? ACCENT : WARN, fontVariantNumeric: "tabular-nums" }}>
                  {row.amount > 0 ? `+${row.amount}` : row.amount}
                </span>
              </div>
            ))}
          </div>
        </SheetFrame>
      ) : null}

      {sheet === "goal" ? (
        <SheetFrame
          title="My goal"
          subtitle="Pick a behavior and a target — the card tracks your week"
          onClose={() => setSheet(null)}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {state.weekProgress.map((p) => {
              const active = (layout.goal?.category ?? null) === p.id;
              const pct = p.possible > 0 ? Math.round((p.earned / p.possible) * 100) : 0;
              return (
                <button
                  key={p.id}
                  onClick={() =>
                    mutateLayout((l) => ({ ...l, goal: { category: p.id, target: l.goal?.target ?? 80 } }))
                  }
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 14px",
                    borderRadius: 12,
                    border: active ? `2px solid ${ACCENT}` : `1px solid ${EDGE}`,
                    background: active ? "rgba(90,208,162,.1)" : PANEL,
                    color: TEXT,
                    cursor: "pointer",
                    fontSize: 14,
                    fontWeight: 700,
                    textAlign: "left",
                  }}
                >
                  <span>{p.name}</span>
                  <span style={{ color: MUTED, fontWeight: 600, fontSize: 12.5, whiteSpace: "nowrap" }}>
                    {p.earned}/{p.possible} · {pct}%
                  </span>
                </button>
              );
            })}
          </div>
          <div style={{ marginTop: 18 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.14em", color: MUTED, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>
              My target
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {GOAL_TARGETS.map((t) => {
                const active = (layout.goal?.target ?? 80) === t;
                return (
                  <button
                    key={t}
                    disabled={!layout.goal}
                    onClick={() =>
                      mutateLayout((l) => (l.goal ? { ...l, goal: { ...l.goal, target: t } } : l))
                    }
                    style={{
                      padding: "10px 16px",
                      borderRadius: 999,
                      border: active ? `2px solid ${ACCENT}` : `1px solid ${EDGE}`,
                      background: active ? "rgba(90,208,162,.12)" : PANEL,
                      color: !layout.goal ? "#555c72" : active ? ACCENT : TEXT,
                      fontSize: 13.5,
                      fontWeight: 800,
                      cursor: layout.goal ? "pointer" : "default",
                    }}
                  >
                    {t}%
                  </button>
                );
              })}
            </div>
            {!layout.goal ? (
              <p style={{ color: MUTED, fontSize: 12, margin: "8px 0 0" }}>Pick a behavior first.</p>
            ) : null}
          </div>
          <button
            onClick={() => setSheet(null)}
            style={{ marginTop: 18, width: "100%", padding: "13px 0", borderRadius: 12, border: "none", background: ACCENT, color: "#08110d", fontWeight: 800, fontSize: 14.5, cursor: "pointer" }}
          >
            Done
          </button>
        </SheetFrame>
      ) : null}

      {sheet === "work" && selected !== null ? (
        <WorkSheet
          initial={layout.items[selected]?.work ?? null}
          onClose={() => setSheet(null)}
          onSave={(work) => {
            const idx = selected;
            mutateLayout((l) => ({
              ...l,
              work: null, // legacy slot retired — links live on the cards now
              items: l.items.map((p, i) =>
                i === idx ? (work ? { ...p, work } : { ...p, work: undefined }) : p
              ),
            }));
            setSheet(null);
            setToast(work ? "Your work is on the door — grab another card from the Shoebox anytime." : "Link removed.");
          }}
        />
      ) : null}

      {sheet === "calendar" ? (
        <SheetFrame
          title={new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" })}
          subtitle="Tap a day — once for ✓ done, twice for no school, again to clear"
          onClose={() => setSheet(null)}
        >
          <CalendarEditor marks={layout.calendar?.marks ?? {}} onTap={cycleCalMark} />
          <div style={{ display: "flex", gap: 14, justifyContent: "center", marginTop: 14, fontSize: 12, color: MUTED }}>
            <span><span style={{ color: "#3BD27A", fontWeight: 800 }}>■</span> school day done</span>
            <span><span style={{ color: "#F0B647", fontWeight: 800 }}>■</span> no school</span>
            <span><span style={{ color: ACCENT, fontWeight: 800 }}>○</span> today</span>
          </div>
          <button
            onClick={() => setSheet(null)}
            style={{ marginTop: 16, width: "100%", padding: "13px 0", borderRadius: 12, border: "none", background: ACCENT, color: "#08110d", fontWeight: 800, fontSize: 14.5, cursor: "pointer" }}
          >
            Done
          </button>
        </SheetFrame>
      ) : null}

      {sheet && typeof sheet === "object" && "shelfDetail" in sheet ? (
        <SheetFrame
          title={sheet.shelfDetail.label}
          subtitle="From your teacher"
          onClose={() => setSheet(null)}
        >
          <div style={{ textAlign: "center", padding: "4px 0" }}>
            <div style={{ width: 150, margin: "0 auto 14px" }}>
              <ShelfArt
                skin={SHELF_TEMPLATE_BY_ID.get(sheet.shelfDetail.template_id)?.skin ?? "ticket"}
                color={SHELF_TEMPLATE_BY_ID.get(sheet.shelfDetail.template_id)?.color ?? "#C9B8E8"}
                label={sheet.shelfDetail.label}
                status={sheet.shelfDetail.status}
              />
            </div>
            {sheet.shelfDetail.note ? (
              <p style={{ background: PANEL, border: `1px solid ${EDGE}`, borderRadius: 12, padding: "12px 14px", color: TEXT, fontSize: 13.5, lineHeight: 1.5, margin: "0 0 14px", textAlign: "left" }}>
                {sheet.shelfDetail.note}
              </p>
            ) : null}
            {sheet.shelfDetail.status === "granted" ? (
              <>
                <button
                  onClick={() => redeemShelfItem(sheet.shelfDetail)}
                  style={{ padding: "13px 28px", borderRadius: 12, border: "none", background: ACCENT, color: "#08110d", fontWeight: 800, fontSize: 14.5, cursor: "pointer" }}
                >
                  Use this
                </button>
                <p style={{ color: MUTED, fontSize: 12, margin: "10px 0 0" }}>
                  Tap when you&apos;re ready to cash it in — your teacher confirms.
                </p>
              </>
            ) : sheet.shelfDetail.status === "pending_redemption" ? (
              <p style={{ color: "#F0B647", fontWeight: 700, fontSize: 14, margin: 0 }}>
                ✋ Hand raised — waiting for your teacher to confirm.
              </p>
            ) : (
              <p style={{ color: ACCENT, fontWeight: 700, fontSize: 14, margin: 0 }}>
                Redeemed ✓ — nice.
              </p>
            )}
          </div>
        </SheetFrame>
      ) : null}

      {sheet && typeof sheet === "object" && "confirm" in sheet ? (
        <SheetFrame title={sheet.confirm.name} subtitle={`◉ ${sheet.confirm.price} · you'd have ◉ ${state.balance - sheet.confirm.price} left`} onClose={() => setSheet("store")}>
          <div style={{ textAlign: "center", padding: "8px 0 4px" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sheet.confirm.asset} alt="" style={{ width: 110, height: 110, objectFit: "contain", marginBottom: 16 }} />
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button
                onClick={() => buy(sheet.confirm)}
                disabled={state.balance < sheet.confirm.price}
                style={{
                  padding: "13px 26px",
                  borderRadius: 12,
                  border: "none",
                  fontWeight: 800,
                  fontSize: 14.5,
                  cursor: "pointer",
                  background: state.balance >= sheet.confirm.price ? ACCENT : "#39405a",
                  color: state.balance >= sheet.confirm.price ? "#08110d" : MUTED,
                }}
              >
                {state.balance >= sheet.confirm.price
                  ? `Buy for ◉ ${sheet.confirm.price}`
                  : `Earn ◉ ${sheet.confirm.price - state.balance} more`}
              </button>
              <button
                onClick={() => setSheet("store")}
                style={{ padding: "13px 22px", borderRadius: 12, border: `1px solid ${EDGE}`, background: "transparent", color: TEXT, fontWeight: 700, fontSize: 14.5, cursor: "pointer" }}
              >
                Not now
              </button>
            </div>
          </div>
        </SheetFrame>
      ) : null}
    </main>
  );
}

// ── pieces ────────────────────────────────────────────────────────────────────

interface LiveCardData {
  weekProgress: LockerState["weekProgress"];
  goalCategory: string | null;
  goalTarget: number;
  calendarMarks: Record<string, CalMark>;
}

function Placed({
  placed,
  idx,
  selected,
  slap,
  settle,
  live,
  onPointerDown,
}: {
  placed: PlacedItem;
  idx: number;
  selected: boolean;
  slap: boolean;
  settle: boolean;
  live?: LiveCardData;
  onPointerDown: (e: React.PointerEvent, idx: number) => void;
}) {
  const item = CATALOG_BY_ID.get(placed.item_id);
  if (!item) return null;
  const w = SIZE[item.type] * 100 * (placed.scale ?? 1);
  // Anchored by center: left/top in door-%, translate(-50%,-50%) + rotate on
  // the inner element. Placed items are absolutely positioned, so moves
  // never reflow the document — cheap even mid-drag on a Chromebook.
  // Slap-down on place, settle on drag end; pressed-on shadow is tighter
  // than the lifted/selected one.
  return (
    <div
      className={`lk-item${slap ? " lk-slap" : settle ? " lk-settle" : ""}`}
      role="button"
      tabIndex={0}
      aria-label={`${item.name} — arrow keys move, [ ] layer, r rotates, + - resizes`}
      onPointerDown={(e) => onPointerDown(e, idx)}
      style={{
        position: "absolute",
        left: `${placed.x * 100}%`,
        top: `${placed.y * 100}%`,
        width: `${w}%`,
        zIndex: placed.z,
        transform: `translate3d(-50%, -50%, 0) rotate(${placed.rot}deg)`,
        filter: selected
          ? `drop-shadow(0 0 6px ${ACCENT}) drop-shadow(0 6px 8px rgba(0,0,0,.4))`
          : "drop-shadow(0 2px 3px rgba(0,0,0,.38))",
        cursor: "grab",
      }}
    >
      {item.type === "card" ? (
        <div style={{ pointerEvents: "none" }}>
          {item.id === "crd-goal" ? (
            <GoalCard
              progress={live?.weekProgress ?? []}
              category={live?.goalCategory ?? null}
              target={live?.goalTarget ?? 80}
            />
          ) : null}
          {item.id === "crd-work" ? <WorkCard work={placed.work ?? null} /> : null}
          {item.id === "crd-month" ? <CalendarCard marks={live?.calendarMarks ?? {}} /> : null}
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.asset} alt="" draggable={false} style={{ width: "100%", display: "block", pointerEvents: "none" }} />
      )}
      {/* foil/holo sheen — one-shot, only when selected (perf + photosensitivity) */}
      {selected && item.rarity !== "common" ? <div className="lk-sheen" /> : null}
    </div>
  );
}

// ── live functional cards (inline SVG — crisp at every scale) ────────────────

function GoalCard({
  progress,
  category,
  target,
}: {
  progress: LockerState["weekProgress"];
  category: string | null;
  target: number;
}) {
  const goal = progress.find((p) => p.id === category) ?? null;
  const pct = goal && goal.possible > 0 ? Math.round((goal.earned / goal.possible) * 100) : 0;
  const met = goal !== null && goal.possible > 0 && pct >= target;
  const barW = 104;
  const barX = (140 - barW) / 2;
  const tickX = barX + (barW * target) / 100;
  return (
    <svg viewBox="0 0 140 92" style={{ width: "100%", display: "block", filter: "drop-shadow(0 1px 1px rgba(0,0,0,.25))" }}>
      <rect x="1" y="6" width="138" height="80" rx="8" fill={met ? "#1C4D3A" : "#16324F"} stroke={met ? "#123626" : "#0c2238"} strokeWidth="1.5" />
      <circle cx="1" cy="46" r="6" fill="#0f1118" />
      <circle cx="139" cy="46" r="6" fill="#0f1118" />
      <text x="70" y="22" fontFamily="Arial" fontWeight="bold" fontSize="9" fill={met ? "#A9F0C9" : "#9BE7FF"} textAnchor="middle" letterSpacing="1.5">
        {met ? "★ GOAL MET ★" : "MY GOAL"}
      </text>
      {goal ? (
        <>
          <text x="70" y="38" fontFamily="Arial" fontWeight="bold" fontSize="11" fill="#fff" textAnchor="middle">
            {goal.name.length > 20 ? `${goal.name.slice(0, 19)}…` : goal.name}
          </text>
          <rect x={barX} y="46" width={barW} height="11" rx="5.5" fill="#0c2238" />
          <rect
            x={barX}
            y="46"
            width={Math.max(4, (barW * Math.min(pct, 100)) / 100)}
            height="11"
            rx="5.5"
            fill={met ? "#3BD27A" : pct >= target - 20 ? "#FFD23B" : "#FF8A65"}
          />
          {/* the target tick — what they're shooting for */}
          <line x1={tickX} y1="42" x2={tickX} y2="61" stroke="#fff" strokeWidth="1.6" strokeDasharray="2 1.6" />
          <text x={tickX} y="69" fontFamily="Arial" fontSize="6.5" fontWeight="bold" fill="#cfd5e4" textAnchor="middle">
            {target}%
          </text>
          <text x="70" y="81" fontFamily="Arial" fontSize="8.5" fill={met ? "#A9F0C9" : "#9aa1b5"} textAnchor="middle">
            {met ? `${pct}% — you did it!` : `${goal.earned}/${goal.possible} pts · ${pct}% so far`}
          </text>
        </>
      ) : (
        <text x="70" y="52" fontFamily="Arial" fontSize="9" fill="#9aa1b5" textAnchor="middle">
          Select me, then “Set my goal”
        </text>
      )}
    </svg>
  );
}

const WORK_HOST_LABEL = (url: string): string => {
  try {
    const u = new URL(url);
    if (u.hostname === "docs.google.com") {
      return u.pathname.startsWith("/presentation") ? "Google Slides" : "Google Doc";
    }
    return "Google Drive";
  } catch {
    return "Link";
  }
};

// The proud-work showcase: gold-star paper holding a pointer to the
// student's own Doc/Slide. Google's sharing permissions decide who can
// actually open it — we never store the content.
function WorkCard({ work }: { work: { url: string; caption: number } | null }) {
  const caption = work ? WORK_CAPTIONS[work.caption] ?? WORK_CAPTIONS[0] : null;
  return (
    <svg viewBox="0 0 110 130" style={{ width: "100%", display: "block", filter: "drop-shadow(0 1px 1px rgba(0,0,0,.25))" }}>
      <g transform="rotate(-2 55 65)">
        <rect x="8" y="10" width="94" height="112" rx="4" fill="#FDFBF4" stroke="#D8D2BF" strokeWidth="1.5" />
        {/* tape corner */}
        <rect x="38" y="4" width="34" height="12" rx="2" fill="#E8E0C8" opacity=".85" transform="rotate(-3 55 10)" />
        {work ? (
          <>
            <path d="M86 16 l3.4 6.9 7.6 1.1 -5.5 5.3 1.3 7.5 -6.8 -3.6 -6.8 3.6 1.3 -7.5 -5.5 -5.3 7.6 -1.1z" fill="#F0B647" stroke="#D89B2A" strokeWidth="1.4" />
            <text x="16" y="40" fontFamily="Georgia, serif" fontStyle="italic" fontWeight="bold" fontSize="10" fill="#2c3440">
              {caption && caption.length > 17 ? `${caption.slice(0, 16)}…` : caption}
            </text>
            {[54, 64, 74, 84].map((y) => (
              <line key={y} x1="16" y1={y} x2="94" y2={y} stroke="#C9D6E4" strokeWidth="2.5" />
            ))}
            <rect x="16" y="98" width="62" height="15" rx="7.5" fill="#16324F" />
            <text x="47" y="108.5" fontFamily="Arial" fontWeight="bold" fontSize="7.5" fill="#9BE7FF" textAnchor="middle">
              {WORK_HOST_LABEL(work.url)} ↗
            </text>
          </>
        ) : (
          <>
            <rect x="20" y="34" width="70" height="64" rx="6" fill="none" stroke="#C9C2AC" strokeWidth="2" strokeDasharray="5 4" />
            <text x="55" y="60" fontFamily="Arial" fontSize="8" fill="#8a917e" textAnchor="middle">Your best work</text>
            <text x="55" y="72" fontFamily="Arial" fontSize="7" fill="#a8af9c" textAnchor="middle">Select me, then</text>
            <text x="55" y="82" fontFamily="Arial" fontSize="7" fill="#a8af9c" textAnchor="middle">“Set my work”</text>
          </>
        )}
      </g>
    </svg>
  );
}

// Edits the proud-work pointer: URL (allowlist-checked here for a friendly
// message, re-checked server-side) + a PRESET caption — never free text.
function WorkSheet({
  initial,
  onSave,
  onClose,
}: {
  initial: { url: string; caption: number } | null;
  onSave: (work: { url: string; caption: number } | null) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState(initial?.url ?? "");
  const [caption, setCaption] = useState(initial?.caption ?? 0);
  const [err, setErr] = useState("");
  return (
    <SheetFrame
      title="My best work"
      subtitle="Paste a link to a Google Doc or Slides you're proud of"
      onClose={onClose}
    >
      <input
        value={url}
        onChange={(e) => {
          setUrl(e.target.value);
          setErr("");
        }}
        placeholder="https://docs.google.com/…"
        inputMode="url"
        autoComplete="off"
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: "12px 14px",
          borderRadius: 12,
          border: `1px solid ${err ? WARN : EDGE}`,
          background: PANEL,
          color: TEXT,
          fontSize: 14,
          outline: "none",
        }}
      />
      {err ? <p style={{ color: WARN, fontSize: 12.5, margin: "8px 0 0", fontWeight: 600 }}>{err}</p> : null}
      <div style={{ margin: "16px 0 0" }}>
        <div style={{ fontSize: 11, letterSpacing: "0.14em", color: MUTED, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>
          Caption
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {WORK_CAPTIONS.map((c, i) => (
            <button
              key={c}
              onClick={() => setCaption(i)}
              style={{
                padding: "9px 14px",
                borderRadius: 999,
                border: caption === i ? `2px solid ${ACCENT}` : `1px solid ${EDGE}`,
                background: caption === i ? "rgba(90,208,162,.12)" : PANEL,
                color: caption === i ? ACCENT : TEXT,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      <p style={{ color: MUTED, fontSize: 12, lineHeight: 1.5, margin: "14px 0 0" }}>
        Who can open it is up to the doc&apos;s own sharing settings — this just puts it on your door.
      </p>
      <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
        <button
          onClick={() => {
            const trimmed = url.trim();
            if (!isAllowedWorkUrl(trimmed)) {
              setErr("Links can only point to Google Docs, Slides, or Drive.");
              return;
            }
            onSave({ url: trimmed, caption });
          }}
          style={{ flex: 1, padding: "13px 0", borderRadius: 12, border: "none", background: ACCENT, color: "#08110d", fontWeight: 800, fontSize: 14.5, cursor: "pointer" }}
        >
          Put it on the door
        </button>
        {initial ? (
          <button
            onClick={() => onSave(null)}
            style={{ padding: "13px 18px", borderRadius: 12, border: "1px solid #5a3232", background: "transparent", color: WARN, fontWeight: 700, fontSize: 14, cursor: "pointer" }}
          >
            Remove
          </button>
        ) : null}
      </div>
    </SheetFrame>
  );
}

// ── month card (functional-objects.md: a calendar that's THEIRS) ─────────────

function monthShape() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const startDow = new Date(year, month, 1).getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const weeks = Math.ceil((startDow + daysInMonth) / 7);
  return { year, month, startDow, daysInMonth, weeks, todayISO: localISO(now) };
}

const dateISO = (year: number, month: number, day: number) =>
  `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

function CalendarCard({ marks }: { marks: Record<string, CalMark> }) {
  const { year, month, startDow, daysInMonth, weeks, todayISO } = monthShape();
  const title = new Date(year, month, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const cellW = 15.7;
  const cellH = 13;
  const gridTop = 30;
  const h = gridTop + weeks * cellH + 5;
  const done = Object.entries(marks).filter(([d, m]) => m === "done" && d.startsWith(dateISO(year, month, 1).slice(0, 8))).length;
  return (
    <svg viewBox={`0 0 118 ${h}`} style={{ width: "100%", display: "block", filter: "drop-shadow(0 1px 1px rgba(0,0,0,.2))" }}>
      <rect x="1" y="1" width="116" height={h - 2} rx="5" fill="#FDFBF4" stroke="#D8D2BF" strokeWidth="1.5" />
      <rect x="1" y="1" width="116" height="15" rx="5" fill="#3A7CC2" />
      <rect x="1" y="10" width="116" height="6" fill="#3A7CC2" />
      <text x="6" y="11.5" fontFamily="Arial" fontWeight="bold" fontSize="7.5" fill="#fff" letterSpacing=".5">
        {title.toUpperCase()}
      </text>
      {done > 0 ? (
        <text x="112" y="11.5" fontFamily="Arial" fontWeight="bold" fontSize="7" fill="#CDE4FA" textAnchor="end">
          {done} ✓
        </text>
      ) : null}
      {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
        <text key={i} x={4.5 + i * cellW + cellW / 2} y="24" fontFamily="Arial" fontSize="5.5" fontWeight="bold" fill="#9aa08f" textAnchor="middle">
          {d}
        </text>
      ))}
      {Array.from({ length: daysInMonth }, (_, d0) => {
        const day = d0 + 1;
        const pos = startDow + d0;
        const col = pos % 7;
        const row = Math.floor(pos / 7);
        const x = 4.5 + col * cellW;
        const y = gridTop + row * cellH;
        const iso = dateISO(year, month, day);
        const mark = marks[iso];
        const weekend = col === 0 || col === 6;
        const fill = mark === "done" ? "#3BD27A" : mark === "off" ? "#F0B647" : weekend ? "#F0ECDD" : "none";
        return (
          <g key={day}>
            {fill !== "none" ? <rect x={x + 1} y={y - 1} width={cellW - 2.5} height={cellH - 2} rx="3" fill={fill} /> : null}
            {iso === todayISO ? (
              <rect x={x + 0.5} y={y - 1.5} width={cellW - 1.5} height={cellH - 1} rx="3.5" fill="none" stroke={ACCENT} strokeWidth="1.4" />
            ) : null}
            <text
              x={x + cellW / 2}
              y={y + 7.5}
              fontFamily="Arial"
              fontSize="6.5"
              fontWeight={mark ? "bold" : "normal"}
              fill={mark === "done" ? "#0b3a22" : mark === "off" ? "#5c4408" : "#2c3440"}
              textAnchor="middle"
            >
              {day}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// The editing grid inside the sheet — same month, big tappable cells.
function CalendarEditor({ marks, onTap }: { marks: Record<string, CalMark>; onTap: (date: string) => void }) {
  const { year, month, startDow, daysInMonth, todayISO } = monthShape();
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6, marginBottom: 6 }}>
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: 10.5, fontWeight: 700, color: MUTED, textTransform: "uppercase", letterSpacing: ".06em" }}>
            {d}
          </div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
        {Array.from({ length: startDow }, (_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, d0) => {
          const day = d0 + 1;
          const iso = dateISO(year, month, day);
          const mark = marks[iso];
          const col = (startDow + d0) % 7;
          const weekend = col === 0 || col === 6;
          return (
            <button
              key={day}
              onClick={() => onTap(iso)}
              aria-label={`${iso}${mark === "done" ? " — done" : mark === "off" ? " — no school" : ""}`}
              style={{
                aspectRatio: "1",
                borderRadius: 10,
                border: iso === todayISO ? `2px solid ${ACCENT}` : `1px solid ${EDGE}`,
                background: mark === "done" ? "#3BD27A" : mark === "off" ? "#F0B647" : weekend ? "#20253694" : PANEL,
                color: mark === "done" ? "#0b3a22" : mark === "off" ? "#5c4408" : TEXT,
                fontSize: 14,
                fontWeight: 800,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {mark === "done" ? "✓" : day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── teacher shelf objects ─────────────────────────────────────────────────────

function ShelfObject({
  item,
  index,
  fresh,
  onOpen,
}: {
  item: ShelfItem;
  index: number;
  fresh: boolean;
  onOpen: () => void;
}) {
  const tpl = SHELF_TEMPLATE_BY_ID.get(item.template_id);
  // First five sit on the shelf; the rest rest on the cavity floor.
  const onShelf = index < 5;
  const slot = onShelf ? index : (index - 5) % 5;
  return (
    <button
      className={fresh ? "lk-fresh" : undefined}
      onClick={onOpen}
      aria-label={`${item.label} — from your teacher`}
      style={{
        position: "absolute",
        left: `${52 + slot * 9.5}%`,
        bottom: onShelf ? "74.3%" : "4%",
        width: "8%",
        zIndex: 45,
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        filter: "drop-shadow(0 3px 2px rgba(0,0,0,.5))",
      }}
    >
      <ShelfArt skin={tpl?.skin ?? "ticket"} color={tpl?.color ?? "#C9B8E8"} label={item.label} status={item.status} />
    </button>
  );
}

function ShelfArt({
  skin,
  color,
  label,
  status,
}: {
  skin: "ticket" | "punch" | "note";
  color: string;
  label: string;
  status: ShelfItem["status"];
}) {
  // up to two short lines of the label on the object itself
  const words = label.split(" ");
  const lines: string[] = [];
  for (const w of words) {
    if (lines.length && (lines[lines.length - 1] + " " + w).length <= 10) {
      lines[lines.length - 1] += ` ${w}`;
    } else {
      lines.push(w);
    }
  }
  const shown = lines.slice(0, 2).map((l) => (l.length > 10 ? `${l.slice(0, 9)}…` : l));
  return (
    <svg viewBox="0 0 90 64" style={{ width: "100%", display: "block" }}>
      {skin === "ticket" ? (
        <g>
          <rect x="3" y="16" width="84" height="42" rx="6" fill={color} stroke="rgba(0,0,0,.3)" strokeWidth="1.5" />
          <circle cx="3" cy="37" r="5" fill="#10131c" />
          <circle cx="87" cy="37" r="5" fill="#10131c" />
          <line x1="68" y1="18" x2="68" y2="56" stroke="rgba(0,0,0,.35)" strokeWidth="1.6" strokeDasharray="3 3" />
          {shown.map((l, i) => (
            <text key={i} x="35" y={shown.length === 1 ? 41 : 35 + i * 12} fontFamily="Arial" fontWeight="bold" fontSize="9" fill="#1d2230" textAnchor="middle">
              {l}
            </text>
          ))}
          <text x="78" y="40" fontFamily="Arial" fontWeight="bold" fontSize="6" fill="rgba(0,0,0,.5)" textAnchor="middle" transform="rotate(90 78 38)">
            ADMIT
          </text>
        </g>
      ) : skin === "punch" ? (
        <g>
          <rect x="5" y="14" width="80" height="44" rx="7" fill={color} stroke="rgba(0,0,0,.28)" strokeWidth="1.5" />
          {shown.map((l, i) => (
            <text key={i} x="45" y={shown.length === 1 ? 33 : 28 + i * 11} fontFamily="Arial" fontWeight="bold" fontSize="9" fill="#3a2430" textAnchor="middle">
              {l}
            </text>
          ))}
          {[0, 1, 2, 3, 4].map((i) => (
            <circle key={i} cx={19 + i * 13} cy="48" r="4" fill="none" stroke="#3a2430" strokeWidth="1.6" />
          ))}
          <path d="M16 45 l6 6 M22 45 l-6 6" stroke="#3a2430" strokeWidth="1.6" />
        </g>
      ) : (
        <g>
          <path d="M12 18 h66 v40 h-66 z" fill="#F7F2E2" stroke="#D8D2BF" strokeWidth="1.5" />
          <path d="M12 18 h66 l-33 18 z" fill="#EFE8D2" stroke="#D8D2BF" strokeWidth="1.2" />
          <circle cx="45" cy="40" r="8" fill="#C0392B" />
          <circle cx="45" cy="40" r="5" fill="none" stroke="#8e2a1f" strokeWidth="1.4" />
          {shown[0] ? (
            <text x="45" y="56" fontFamily="Georgia, serif" fontStyle="italic" fontSize="7.5" fill="#5a5240" textAnchor="middle">
              {shown.join(" ")}
            </text>
          ) : null}
        </g>
      )}
      {status === "pending_redemption" ? (
        <g>
          <rect x="21" y="1" width="48" height="13" rx="6.5" fill="#F0B647" />
          <text x="45" y="10.5" fontFamily="Arial" fontWeight="bold" fontSize="7.5" fill="#3a2c0a" textAnchor="middle">
            WAITING
          </text>
        </g>
      ) : null}
      {status === "redeemed" ? (
        <g transform="rotate(-10 45 37)">
          <rect x="10" y="28" width="70" height="17" rx="3" fill="rgba(253,251,244,.75)" stroke="#E8485C" strokeWidth="2" />
          <text x="45" y="40.5" fontFamily="Arial" fontWeight="bold" fontSize="9.5" fill="#E8485C" textAnchor="middle" letterSpacing="1">
            REDEEMED
          </text>
        </g>
      ) : null}
    </svg>
  );
}

function Chip({ label, onClick, active, title }: { label: string; onClick: () => void; active?: boolean; title?: string }) {
  return (
    <button
      className="lk-chip"
      onClick={onClick}
      title={title}
      style={{
        padding: "9px 14px",
        borderRadius: 999,
        border: `1px solid ${active ? ACCENT_DARK : EDGE}`,
        background: active ? "rgba(90,208,162,.12)" : PANEL,
        color: active ? ACCENT : TEXT,
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function Pill({ label, onClick, warn }: { label: string; onClick: () => void; warn?: boolean }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: "10px 14px",
        borderRadius: 999,
        border: `1px solid ${warn ? "#5a3232" : EDGE}`,
        background: PANEL,
        color: warn ? WARN : TEXT,
        fontSize: 12.5,
        fontWeight: 700,
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

function SheetFrame({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-label={title}
      style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 14 }}
    >
      <div className="lk-backdrop" onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(5,6,10,.66)" }} />
      <div
        className="lk-sheet"
        style={{
          position: "relative",
          width: "min(560px, calc(100vw - 28px))",
          maxHeight: "calc(100dvh - 48px)",
          overflowY: "auto",
          overscrollBehavior: "contain",
          background: PANEL2,
          borderRadius: 18,
          border: `1px solid ${EDGE}`,
          padding: "18px 18px 22px",
          boxSizing: "border-box",
          boxShadow: "0 30px 80px rgba(0,0,0,.6)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <h2 style={{ fontSize: 17, fontWeight: 800, margin: 0, color: TEXT }}>{title}</h2>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: MUTED, fontSize: 22, cursor: "pointer", lineHeight: 1 }}>
            ×
          </button>
        </div>
        <p style={{ color: MUTED, fontSize: 12.5, margin: "0 0 14px" }}>{subtitle}</p>
        {children}
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, background: PANEL, border: `1px solid ${EDGE}`, borderRadius: 12, padding: "12px 14px" }}>
      <div style={{ fontSize: 11, color: MUTED, textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color: TEXT, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

const cellStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 6,
  background: PANEL,
  border: `1px solid ${EDGE}`,
  borderRadius: 12,
  padding: "12px 8px 10px",
  cursor: "pointer",
};

function clamp(v: number) {
  return Math.max(-0.15, Math.min(1.15, v));
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: INK,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: MUTED,
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        fontSize: 15,
      }}
    >
      {children}
    </main>
  );
}

function ledgerLabel(row: { entry_type: string; ref: Record<string, unknown>; created_at: string }): string {
  const date = new Date(row.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const kind = row.ref?.kind;
  if (kind === "daily_earn") return `${row.ref.date} · points you earned in class`;
  if (kind === "welcome_grant") return `${date} · locker-warming gift`;
  if (kind === "purchase") {
    const item = CATALOG_BY_ID.get(String(row.ref.item_id ?? ""));
    return `${date} · bought ${item?.name ?? row.ref.item_id}`;
  }
  if (kind === "teacher_adjustment") return `${date} · teacher adjustment`;
  return `${date} · ${row.entry_type}`;
}
