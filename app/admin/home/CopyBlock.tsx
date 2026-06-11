"use client";

// Copy-to-clipboard block for the director home's teacher onboarding blurb.

import { useState } from "react";

export default function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div>
      <pre
        style={{
          whiteSpace: "pre-wrap",
          fontFamily: "var(--ssd-font-body), system-ui, sans-serif",
          fontSize: 13.5,
          lineHeight: 1.6,
          color: "var(--ssd-text)",
          background: "var(--ssd-paper)",
          border: "1px solid var(--ssd-border)",
          borderRadius: "var(--ssd-radius-sm, 8px)",
          padding: "14px 16px",
          margin: 0,
        }}
      >
        {text}
      </pre>
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            // Selection fallback: user can copy manually.
          }
        }}
        style={{
          marginTop: 10,
          fontSize: 13,
          fontWeight: 600,
          padding: "8px 16px",
          borderRadius: 999,
          border: "none",
          background: copied ? "var(--ssd-green)" : "var(--ssd-green-deep)",
          color: "#fff",
          cursor: "pointer",
        }}
      >
        {copied ? "Copied ✓" : "Copy to clipboard"}
      </button>
    </div>
  );
}
