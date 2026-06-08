import { createClient } from "@supabase/supabase-js";
import MagicLinkSummary, {
  InvalidLinkCard,
  type ScoreRow,
  type NoteRow,
  type StudentRow,
} from "@/src/components/MagicLinkSummary";
import type { CategoryDef } from "@/src/components/BehaviorCharts";
import CoteacherWritePanel from "@/src/components/CoteacherWritePanel";

interface CoteacherView {
  student: StudentRow | null;
  access: string;
  scores: ScoreRow[];
  notes: NoteRow[];
  categories?: CategoryDef[];
}

export default async function CoteacherPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return <InvalidLinkCard />;

  const supabase = createClient(url, anon);
  const { data, error } = await supabase.rpc("get_coteacher_view", {
    p_raw_token: token,
  });

  if (error || !data) return <InvalidLinkCard message="It may have expired or been turned off. Ask the lead teacher for a new link." />;

  const view = data as CoteacherView;
  if (!view.student) return <InvalidLinkCard message="It may have expired or been turned off. Ask the lead teacher for a new link." />;

  const canWrite = view.access === "readwrite";
  const banner = (
    <div
      style={{
        background: "var(--ssd-surface)",
        border: "1px solid var(--ssd-border)",
        borderLeft: `3px solid ${canWrite ? "var(--ssd-green)" : "var(--ssd-amber)"}`,
        borderRadius: "var(--ssd-radius-sm)",
        padding: "10px 14px",
        marginBottom: 20,
        fontSize: 13,
        color: "var(--ssd-text)",
      }}
    >
      <strong style={{ color: "var(--ssd-ink)" }}>Co-teacher access:</strong>{" "}
      {canWrite
        ? "you can add today's scores and shared notes below; everything else is the student's summary."
        : "you have a read-only view of this student's summary."}
    </div>
  );

  return (
    <MagicLinkSummary
      student={view.student}
      scores={Array.isArray(view.scores) ? view.scores : []}
      notes={Array.isArray(view.notes) ? view.notes : []}
      categories={Array.isArray(view.categories) ? view.categories : []}
      eyebrow="· DailyWins · Co-teacher ·"
      subtitle="Shared behavior summary"
      banner={banner}
      writePanel={
        canWrite ? (
          <CoteacherWritePanel
            token={token}
            categories={Array.isArray(view.categories) ? view.categories : []}
          />
        ) : undefined
      }
    />
  );
}
