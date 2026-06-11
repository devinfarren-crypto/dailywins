// Cross-links between the Site Admin surfaces so each is reachable from the
// others. Rendered for site admins on /admin/upload-schedule, /admin/teachers,
// /admin/usage and /admin/links.

type Current = "home" | "schedules" | "teachers" | "usage" | "links" | "audit" | "records";

const LINKS: { key: Current; label: string; href: string }[] = [
  { key: "home", label: "Home", href: "/admin/home" },
  { key: "schedules", label: "Bell schedules", href: "/admin/upload-schedule" },
  { key: "teachers", label: "Teachers", href: "/admin/teachers" },
  { key: "usage", label: "School usage", href: "/admin/usage" },
  { key: "links", label: "Family links", href: "/admin/links" },
  { key: "records", label: "Student records", href: "/admin/records" },
  { key: "audit", label: "Audit log", href: "/admin/audit-log" },
];

export default function SiteAdminNav({ current }: { current: Current }) {
  return (
    <nav
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 4,
        marginBottom: 24,
        borderBottom: "1px solid var(--ssd-border)",
        paddingBottom: 4,
      }}
    >
      {LINKS.map((l) => {
        const active = l.key === current;
        return (
          <a
            key={l.key}
            href={l.href}
            aria-current={active ? "page" : undefined}
            style={{
              fontSize: 13,
              fontWeight: 600,
              padding: "8px 12px",
              textDecoration: "none",
              color: active ? "var(--ssd-ink)" : "var(--ssd-text-muted)",
              borderBottom: active
                ? "2px solid var(--ssd-green)"
                : "2px solid transparent",
              marginBottom: -5,
            }}
          >
            {l.label}
          </a>
        );
      })}
    </nav>
  );
}
