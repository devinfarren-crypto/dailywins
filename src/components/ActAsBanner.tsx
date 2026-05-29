import { getCurrentActAsSession } from "@/src/lib/act-as-current";
import ActAsExitButton from "./ActAsExitButton";

export default async function ActAsBanner() {
  const session = await getCurrentActAsSession();
  if (!session) return null;

  const isBreakGlass = session.break_glass;
  const expiresInMinutes = Math.max(
    0,
    Math.round((new Date(session.expires_at).getTime() - Date.now()) / 60000)
  );

  return (
    <div
      role="alert"
      className={`sticky top-0 z-50 w-full border-b ${
        isBreakGlass
          ? "bg-rose-600 border-rose-700 text-white"
          : "bg-[#e07850] border-[#c0612d] text-white"
      }`}
    >
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-2 text-sm">
        <span className="font-semibold uppercase tracking-wide">
          {isBreakGlass ? "Break-glass" : "Acting as"}
        </span>
        <span className="font-semibold">
          {session.target_full_name}
        </span>
        <span className="opacity-90">({session.target_email})</span>
        <span className="opacity-75">
          · {expiresInMinutes} min remaining
        </span>
        {isBreakGlass && session.reason ? (
          <span className="opacity-75">· Reason: {session.reason}</span>
        ) : null}
        <span className="ml-auto">
          <ActAsExitButton />
        </span>
      </div>
    </div>
  );
}
