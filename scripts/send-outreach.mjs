// Founder CLI: send a director-outreach email through the deployed app.
//   node scripts/send-outreach.mjs <config.json> [--to override@example.com]
// The config file holds the school personalization (see docs/OUTREACH.md).
// Auth = the service-role key from .env.local, presented as a bearer token —
// only founder machines can send. Real prospect configs live OUTSIDE the repo
// (the repo is public): keep them in dailywins-marketing/outreach/.
import fs from "node:fs";

const configPath = process.argv[2];
if (!configPath) {
  console.error("usage: node scripts/send-outreach.mjs <config.json> [--to email]");
  process.exit(1);
}
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const toFlag = process.argv.indexOf("--to");
const to = toFlag > -1 ? process.argv[toFlag + 1] : config.to;
if (!to) {
  console.error("no recipient: set \"to\" in the config or pass --to");
  process.exit(1);
}

const env = fs.readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const key = env.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)?.[1]?.trim();
if (!key) {
  console.error(".env.local is missing SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const origin = config.origin ?? "https://dailywins.school";
const res = await fetch(`${origin}/api/outreach/send`, {
  method: "POST",
  headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
  body: JSON.stringify({ to, school: config.school, subject: config.subject }),
});
const data = await res.json().catch(() => null);
if (!res.ok || !data?.ok) {
  console.error("send FAILED", res.status, data);
  process.exit(1);
}
console.log(`sent to ${to} — resend id ${data.id}`);
