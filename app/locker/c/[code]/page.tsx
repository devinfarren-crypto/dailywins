import type { Metadata } from "next";
import ComboClient from "./ComboClient";

export const metadata: Metadata = { title: "Your Locker — DailyWins" };
export const dynamic = "force-dynamic";

// The class locker link a teacher shares. The page itself carries no student
// identity — the 3-number combo (printed slip) is what claims the locker.
export default async function LockerComboPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <ComboClient code={code} />;
}
