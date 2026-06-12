// The teacher shelf (docs/locker/teacher-shelf.md): real-world rewards as
// physical objects on the cavity shelf. Grants, not purchases — the points
// ledger is never touched. Shared by the teacher/student routes and both UIs.

export const SHELF_TEMPLATES = [
  { id: "hw-pass", label: "Homework Pass", skin: "ticket", color: "#F4B23E" },
  { id: "late-pass", label: "Late Pass", skin: "ticket", color: "#7FB4E8" },
  { id: "snack-coupon", label: "Snack Coupon", skin: "punch", color: "#E88AA5" },
  { id: "front-of-line", label: "Front of the Line", skin: "ticket", color: "#8FD49A" },
  { id: "shoutout", label: "Shoutout", skin: "note", color: "#F0E6C8" },
  { id: "custom", label: "Custom reward", skin: "ticket", color: "#C9B8E8" },
] as const;

export type ShelfTemplateId = (typeof SHELF_TEMPLATES)[number]["id"];

export const SHELF_TEMPLATE_BY_ID = new Map(SHELF_TEMPLATES.map((t) => [t.id, t]));

export function shelfLabel(template_id: string, custom_label: string | null): string {
  if (template_id === "custom" && custom_label) return custom_label;
  return SHELF_TEMPLATE_BY_ID.get(template_id as ShelfTemplateId)?.label ?? "Reward";
}

export interface ShelfItem {
  id: string;
  template_id: ShelfTemplateId;
  label: string;
  note: string | null;
  status: "granted" | "pending_redemption" | "redeemed";
  granted_at: string;
  redeemed_at: string | null;
  seen: boolean;
}
