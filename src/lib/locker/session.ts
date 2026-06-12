import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

// Locker access is DailyWins-native (decision #8): no Supabase Auth session
// for students. The combo claim sets a long-lived httpOnly cookie whose value
// is the identity's claim_secret (an unguessable uuid); every locker API
// resolves it server-side with the service-role client. RLS on locker tables
// has zero policies — this resolver IS the gate.

export const LOCKER_COOKIE = "dw_locker";
export const LOCKER_COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // a school year-ish

export interface LockerIdentity {
  identityId: string;
  studentId: string; // canonical row
  teacherId: string;
  displayName: string;
  schoolId: string;
}

export async function resolveLockerIdentity(
  admin: SupabaseClient
): Promise<LockerIdentity | null> {
  const jar = await cookies();
  const secret = jar.get(LOCKER_COOKIE)?.value;
  if (!secret || !/^[0-9a-f-]{36}$/i.test(secret)) return null;

  const { data } = await admin
    .from("locker_identities")
    .select("id, student_id, teacher_id, claimed_at, students(display_name, school_id, canonical_id)")
    .eq("claim_secret", secret)
    .maybeSingle();
  if (!data || !data.claimed_at) return null;

  const student = data.students as unknown as
    | { display_name: string; school_id: string; canonical_id: string | null }
    | null;
  return {
    identityId: data.id as string,
    studentId: (student?.canonical_id ?? data.student_id) as string,
    teacherId: data.teacher_id as string,
    displayName: student?.display_name ?? "Student",
    schoolId: student?.school_id ?? "",
  };
}

/** All roster rows that belong to this canonical student (incl. itself). */
export async function canonicalGroupIds(
  admin: SupabaseClient,
  canonicalId: string
): Promise<string[]> {
  const { data } = await admin
    .from("students")
    .select("id")
    .or(`id.eq.${canonicalId},canonical_id.eq.${canonicalId}`);
  return (data ?? []).map((r) => r.id as string);
}
