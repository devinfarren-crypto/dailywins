import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Supabase SSR session refresh. Without this, server components can't persist a
// rotated access token (the server client's setAll is a no-op in a Server
// Component) — so after the ~1h access-token lifetime, server-rendered pages
// (e.g. /admin/*) stop seeing the session and bounce to the login page. This
// middleware runs on every request, refreshes the session, and writes the
// rotated cookies onto the response. It does NOT gate or redirect — auth routing
// stays in the pages/route handlers.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Touch the session so an expired access token is rotated and the new cookies
  // are written to `response`. Never throw out of middleware.
  try {
    await supabase.auth.getUser();
  } catch {
    // ignore — a failed refresh just leaves the request unauthenticated
  }

  return response;
}

export const config = {
  // Run on everything except Next internals and static assets.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.json|icons/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
