import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Access Denied — DailyWins",
};

export default function AccessDeniedPage() {
  return (
    <div className="min-h-screen bg-[#f5f5f0] flex items-center justify-center px-6">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-sm border border-gray-200 p-10 text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#3a7c6a] text-white text-2xl font-bold">
          DW
        </div>
        <h1 className="text-2xl font-bold text-[#2a4d42] mb-3">
          Access Denied
        </h1>
        <p className="text-gray-700 leading-relaxed mb-8">
          DailyWins is currently in a closed pilot. If you&rsquo;re a teacher
          who&rsquo;d like to try it, please contact{" "}
          <a
            href="mailto:devin@surestepeducation.com"
            className="text-[#3a7c6a] underline hover:text-[#2a4d42]"
          >
            devin@surestepeducation.com
          </a>
          .
        </p>
        <Link
          href="/"
          className="text-sm text-[#3a7c6a] hover:text-[#2a4d42] transition-colors"
        >
          &larr; Back to home
        </Link>
      </div>
    </div>
  );
}
