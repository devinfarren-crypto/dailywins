import type { EnrichedAuditRow } from "@/src/lib/audit-log-query";

function formatWhen(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function ActionBadge({ action, breakGlass }: { action: string; breakGlass: boolean }) {
  const styles = breakGlass
    ? "border-rose-300 bg-rose-50 text-rose-700"
    : action.startsWith("act_as.start") || action.startsWith("break_glass.start")
      ? "border-amber-300 bg-amber-50 text-amber-700"
      : action.startsWith("act_as.end") || action.startsWith("break_glass.end")
        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
        : "border-gray-300 bg-gray-50 text-gray-700";
  return (
    <span
      className={`rounded-md border px-2 py-0.5 font-mono text-xs ${styles}`}
    >
      {action}
    </span>
  );
}

export default function AuditRowList({
  rows,
  emptyLabel = "No audit rows yet.",
}: {
  rows: EnrichedAuditRow[];
  emptyLabel?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center text-[#8a9690]">
        {emptyLabel}
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li
          key={r.id}
          className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
        >
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <ActionBadge action={r.action} breakGlass={r.break_glass} />
            <span className="text-[#8a9690]">{formatWhen(r.created_at)}</span>
            {r.break_glass ? (
              <span className="rounded-md border border-rose-300 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                BREAK-GLASS
              </span>
            ) : null}
          </div>

          <div className="mt-2 grid grid-cols-1 gap-1 text-sm text-gray-700 md:grid-cols-2">
            <div>
              <span className="text-[#8a9690]">Actor:</span>{" "}
              <span className="font-mono">{r.actor_email ?? r.actor_user_id}</span>
            </div>
            {r.acting_as_user_id ? (
              <div>
                <span className="text-[#8a9690]">Acting as:</span>{" "}
                <span className="font-mono">
                  {r.acting_as_email ?? r.acting_as_user_id}
                </span>
              </div>
            ) : null}
            {r.target_table ? (
              <div>
                <span className="text-[#8a9690]">Target:</span>{" "}
                <span className="font-mono text-xs">
                  {r.target_table}
                  {r.target_id ? ` · ${r.target_id.slice(0, 8)}…` : ""}
                </span>
              </div>
            ) : null}
            {r.reason ? (
              <div className="md:col-span-2">
                <span className="text-[#8a9690]">Reason:</span> {r.reason}
              </div>
            ) : null}
          </div>

          {r.before || r.after ? (
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer text-[#8a9690] hover:text-[#2a4d42]">
                Diff
              </summary>
              <pre className="mt-2 overflow-x-auto rounded-md bg-[#faf7f0] p-2 text-[11px] text-gray-700">
                {JSON.stringify(
                  { before: r.before ?? null, after: r.after ?? null },
                  null,
                  2
                )}
              </pre>
            </details>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
