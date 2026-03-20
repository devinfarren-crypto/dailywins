"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";
import dynamic from "next/dynamic";

// Dynamically import the heavy dashboard component with ssr: false.
// This ensures browser-only libraries (Recharts, canvas APIs) never
// run during server-side rendering, preventing silent module crashes.
const DashboardClient = dynamic(() => import("./DashboardClient"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "#f5f5f0" }}>
      <div style={{ background: "white", borderRadius: 16, padding: 32, textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>
        <div style={{
          background: "#e07850",
          width: 48,
          height: 48,
          borderRadius: 12,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontWeight: 800,
          fontSize: 18,
          margin: "0 auto 16px",
        }}>DW</div>
        <div style={{ color: "#2c3e50", fontSize: 16, fontWeight: 600 }}>Loading DailyWins...</div>
      </div>
    </div>
  ),
});

// Error boundary catches any runtime errors in the dashboard
class DashboardErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Dashboard error boundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f0", padding: 20 }}>
          <div style={{ background: "white", borderRadius: 16, padding: 32, maxWidth: 500, textAlign: "center", boxShadow: "0 2px 12px rgba(0,0,0,0.1)" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>&#9888;&#65039;</div>
            <h2 style={{ color: "#2c3e50", fontSize: 20, fontWeight: 700, margin: "0 0 8px" }}>Something went wrong</h2>
            <p style={{ color: "#888", fontSize: 14, margin: "0 0 16px" }}>{this.state.error?.message}</p>
            <pre style={{ background: "#f5f5f0", borderRadius: 8, padding: 12, fontSize: 11, color: "#666", textAlign: "left", overflow: "auto", maxHeight: 120 }}>
              {this.state.error?.stack}
            </pre>
            <button
              onClick={() => window.location.reload()}
              style={{ background: "#e07850", color: "white", border: "none", borderRadius: 8, padding: "10px 24px", fontSize: 14, fontWeight: 700, cursor: "pointer", marginTop: 16 }}
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function DashboardPage() {
  return (
    <DashboardErrorBoundary>
      <DashboardClient />
    </DashboardErrorBoundary>
  );
}
