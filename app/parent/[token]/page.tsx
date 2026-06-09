import { createClient } from "@supabase/supabase-js";
import MagicLinkSummary, {
  InvalidLinkCard,
  type ScoreRow,
  type NoteRow,
  type StudentRow,
} from "@/src/components/MagicLinkSummary";
import type { CategoryDef } from "@/src/components/BehaviorCharts";

interface ParentView {
  student: StudentRow | null;
  scores: ScoreRow[];
  notes: NoteRow[];
  categories?: CategoryDef[];
  progress_icon?: string;
}

export default async function ParentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return <InvalidLinkCard />;

  const supabase = createClient(url, anon);
  const { data, error } = await supabase.rpc("get_parent_view", {
    p_raw_token: token,
  });

  if (error || !data)
    return (
      <InvalidLinkCard message="It may have expired or been turned off. Ask your child's teacher for a new link." />
    );

  const view = data as ParentView;
  if (!view.student)
    return (
      <InvalidLinkCard message="It may have expired or been turned off. Ask your child's teacher for a new link." />
    );

  return (
    <MagicLinkSummary
      student={view.student}
      scores={Array.isArray(view.scores) ? view.scores : []}
      notes={Array.isArray(view.notes) ? view.notes : []}
      categories={Array.isArray(view.categories) ? view.categories : []}
      progressIcon={view.progress_icon}
      eyebrow="· DailyWins ·"
      subtitle="Behavior summary"
    />
  );
}
