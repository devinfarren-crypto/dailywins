"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import QuietLoader from "@/src/components/QuietLoader";

// The public sandbox: the REAL product components (grid behavior, category
// customization, BehaviorCharts, the printable record PDF) running on
// fictional in-memory students. No auth, no database — nothing to leak,
// nothing to break. Recharts + jspdf are browser-only, hence ssr: false;
// Suspense satisfies useSearchParams during prerender.
const DemoClient = dynamic(() => import("./DemoClient"), {
  ssr: false,
  loading: () => <QuietLoader />,
});

export default function DemoPage() {
  return (
    <Suspense fallback={<QuietLoader />}>
      <DemoClient />
    </Suspense>
  );
}
