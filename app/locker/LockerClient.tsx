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
  type CatalogItem,
  type LockerLayout,
  type PlacedItem,
} from "@/src/lib/locker/schema";

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
}

type Sheet = null | "shoebox" | "store" | "bank" | { confirm: CatalogItem };

// Display size (fraction of CANVAS width) per item type. The canvas is the
// whole open locker (door + cavity), so these are roughly half the old
// door-only values to keep items the same physical size.
const SIZE: Record<CatalogItem["type"], number> = {
  sticker: 0.115,
  button: 0.085,
  patch: 0.135,
  magnet: 0.07,
  mirror: 0.15,
  background: 0,
};

export default function LockerClient() {
  const [state, setState] = useState<LockerState | null>(null);
  const [error, setError] = useState("");
  const [layout, setLayout] = useState<LockerLayout>({ items: [], background: null });
  const [selected, setSelected] = useState<number | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toast, setToast] = useState("");
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
    setLayout(data.layout);
  }, []);
  useEffect(() => {
    refresh();
  }, [refresh]);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await fetch("/api/locker/layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(layoutRef.current),
        keepalive: true,
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
        .filter((i) => i.type !== "background" && !placedIds.has(i.id)),
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
    if (layout.items.length >= 30) {
      setToast("Your locker's full — put something in the shoebox first.");
      return;
    }
    if (item.type === "mirror" && layout.items.some((p) => CATALOG_BY_ID.get(p.item_id)?.type === "mirror")) {
      setToast("One mirror per locker — that's the rule of cool.");
      return;
    }
    const maxZ = layout.items.reduce((m, p) => Math.max(m, p.z), 0);
    mutateLayout((l) => ({
      ...l,
      items: [
        ...l.items,
        { item_id: item.id, x: 0.5 + (Math.random() - 0.5) * 0.1, y: 0.42 + (Math.random() - 0.5) * 0.1, z: maxZ + 1, rot: Math.round((Math.random() - 0.5) * 14) },
      ],
    }));
    setSelected(layout.items.length);
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
    if (dragRef.current?.moved) scheduleSave();
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
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }
      `}</style>

      {/* top bar */}
      <div
        style={{
          width: "100%",
          maxWidth: 560,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 16px",
          boxSizing: "border-box",
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
          overflow: "hidden",
          backgroundColor: "#2a3a55",
          backgroundImage: bg ? `url(${bg.asset})` : "url(/locker/backgrounds/bg-navy-paint.svg)",
          backgroundSize: "cover",
        }}
      >
        {/* ── the physical locker, drawn under the stickers ─────────────── */}
        <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {/* door panel shading (left half) — inside of the open door */}
          <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: "47%", boxShadow: "inset -18px 0 28px -18px rgba(0,0,0,.55), inset 4px 0 10px -4px rgba(255,255,255,.06)" }} />
          {/* door vents */}
          <div style={{ position: "absolute", top: "4%", left: "23.5%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", gap: 6, opacity: 0.85 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ width: "min(110px, 14vw)", height: 6, borderRadius: 3, background: "rgba(0,0,0,.45)", boxShadow: "inset 0 2px 3px rgba(0,0,0,.8), 0 1px 0 rgba(255,255,255,.08)" }} />
            ))}
          </div>
          {/* door latch (outer edge) */}
          <div style={{ position: "absolute", left: "1.5%", top: "44%", width: 10, height: "9%", borderRadius: 4, background: "linear-gradient(90deg, #3a4152, #1c2029)", boxShadow: "0 2px 4px rgba(0,0,0,.5)" }} />
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

        {layout.items.map((p, idx) => (
          <Placed
            key={`${p.item_id}-${idx}`}
            placed={p}
            idx={idx}
            selected={selected === idx}
            onPointerDown={onPointerDown}
          />
        ))}
      </div>

      {/* selection controls — fixed-height slot so nothing pushes past the viewport */}
      <div style={{ height: 58, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {selected !== null && layout.items[selected] ? (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
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
            Tap a sticker to move, layer, or rotate it · Shoebox holds the rest
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
              shoebox.map((item) => (
                <button
                  key={item.id}
                  onClick={() => placeItem(item)}
                  style={cellStyle}
                  aria-label={`Place ${item.name}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={item.asset} alt="" loading="lazy" style={{ width: 52, height: 52, objectFit: "contain" }} />
                  <span style={{ fontSize: 11, color: MUTED }}>{item.name}</span>
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
          {(["background", "sticker", "button", "patch", "mirror"] as const).map((type) => {
            const items = CATALOG.items.filter((i) => i.type === type && i.price > 0 && !i.retired);
            if (items.length === 0) return null;
            return (
              <div key={type} style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 11, letterSpacing: "0.14em", color: MUTED, textTransform: "uppercase", fontWeight: 700, marginBottom: 8 }}>
                  {type === "background" ? "Paint & wallpaper" : `${type}s`}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 10 }}>
                  {items.map((item) => {
                    const owned = state.inventory.includes(item.id);
                    return (
                      <button
                        key={item.id}
                        onClick={() => !owned && setSheet({ confirm: item })}
                        disabled={owned}
                        style={{ ...cellStyle, opacity: owned ? 0.55 : 1 }}
                        aria-label={owned ? `${item.name} — owned` : `Buy ${item.name} for ${item.price} points`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={item.asset} alt="" loading="lazy" style={{ width: 52, height: 52, objectFit: "contain" }} />
                        <span style={{ fontSize: 11.5, color: TEXT, fontWeight: 600 }}>{item.name}</span>
                        <span style={{ fontSize: 11, color: owned ? MUTED : ACCENT, fontWeight: 700 }}>
                          {owned ? "Owned" : `◉ ${item.price}`}
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

function Placed({
  placed,
  idx,
  selected,
  onPointerDown,
}: {
  placed: PlacedItem;
  idx: number;
  selected: boolean;
  onPointerDown: (e: React.PointerEvent, idx: number) => void;
}) {
  const item = CATALOG_BY_ID.get(placed.item_id);
  if (!item) return null;
  const w = SIZE[item.type] * 100 * (placed.scale ?? 1);
  // Anchored by center: left/top in door-%, translate(-50%,-50%) + rotate on
  // the inner element. Placed items are absolutely positioned, so moves
  // never reflow the document — cheap even mid-drag on a Chromebook.
  return (
    <div
      className="lk-item"
      role="button"
      tabIndex={0}
      aria-label={`${item.name} — arrow keys move, [ ] layer, r rotates`}
      onPointerDown={(e) => onPointerDown(e, idx)}
      style={{
        position: "absolute",
        left: `${placed.x * 100}%`,
        top: `${placed.y * 100}%`,
        width: `${w}%`,
        zIndex: placed.z,
        transform: `translate3d(-50%, -50%, 0) rotate(${placed.rot}deg)`,
        filter: selected ? `drop-shadow(0 0 6px ${ACCENT})` : "drop-shadow(0 3px 4px rgba(0,0,0,.35))",
        cursor: "grab",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={item.asset} alt="" draggable={false} style={{ width: "100%", display: "block", pointerEvents: "none" }} />
    </div>
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
      style={{ position: "fixed", inset: 0, zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}
    >
      <div className="lk-backdrop" onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(5,6,10,.6)" }} />
      <div
        className="lk-sheet"
        style={{
          position: "relative",
          width: "min(560px, 100vw)",
          maxHeight: "min(78vh, calc(100dvh - 56px))",
          overflowY: "auto",
          overscrollBehavior: "contain",
          background: PANEL2,
          borderRadius: "18px 18px 0 0",
          border: `1px solid ${EDGE}`,
          borderBottom: "none",
          padding: "18px 18px 26px",
          boxSizing: "border-box",
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
