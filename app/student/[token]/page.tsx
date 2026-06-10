import { createClient } from "@supabase/supabase-js";
import MagicLinkSummary, {
  InvalidLinkCard,
  type ScoreRow,
  type NoteRow,
  type StudentRow,
} from "@/src/components/MagicLinkSummary";
import type { CategoryDef } from "@/src/components/BehaviorCharts";
import StudentSelfAssessPanel from "@/src/components/StudentSelfAssessPanel";

interface StudentView {
  student: StudentRow | null;
  scores: ScoreRow[];
  notes: NoteRow[];
  categories?: CategoryDef[];
  progress_icon?: string;
}

export default async function StudentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return <InvalidLinkCard />;

  const supabase = createClient(url, anon);
  const { data, error } = await supabase.rpc("get_student_view", {
    p_raw_token: token,
  });

  if (error || !data) return <InvalidLinkCard message="It may have expired or been turned off. Ask your teacher for a new link." />;

  const view = data as StudentView;
  if (!view.student) return <InvalidLinkCard message="It may have expired or been turned off. Ask your teacher for a new link." />;

  // Self-assessment is the readwrite variant of the student link — the teacher
  // opted in when generating it. validate_magic_link tells us the access level.
  const { data: validation } = await supabase.rpc("validate_magic_link", {
    p_raw_token: token,
  });
  const v = Array.isArray(validation) ? validation[0] : validation;
  const canSelfAssess = Boolean(v?.out_valid) && v?.out_access === "readwrite";

  const categories = Array.isArray(view.categories) ? view.categories : [];

  return (
    <MagicLinkSummary
      student={view.student}
      scores={Array.isArray(view.scores) ? view.scores : []}
      notes={Array.isArray(view.notes) ? view.notes : []}
      categories={categories}
      progressIcon={view.progress_icon}
      eyebrow="· Your DailyWins ·"
      subtitle="Your behavior summary"
      writePanel={
        canSelfAssess ? (
          <StudentSelfAssessPanel token={token} categories={categories} />
        ) : undefined
      }
    />
  );
}
