import { createClient } from "@supabase/supabase-js";
import MagicLinkSummary, {
  InvalidLinkCard,
  type ScoreRow,
  type NoteRow,
  type StudentRow,
} from "@/src/components/MagicLinkSummary";
import type { CategoryDef } from "@/src/components/BehaviorCharts";

interface StudentView {
  student: StudentRow | null;
  scores: ScoreRow[];
  notes: NoteRow[];
  categories?: CategoryDef[];
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

  return (
    <MagicLinkSummary
      student={view.student}
      scores={Array.isArray(view.scores) ? view.scores : []}
      notes={Array.isArray(view.notes) ? view.notes : []}
      categories={Array.isArray(view.categories) ? view.categories : []}
      eyebrow="· Your DailyWins ·"
      subtitle="Your behavior summary"
    />
  );
}
