import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // NOTE: www → non-www redirect should be configured in Vercel project
  // settings (Settings → Domains), not here. Doing it in middleware can
  // cause infinite redirect loops with certain proxy/CDN configurations.

  // ─── Supabase client with cookie bridge ───────────────────────────────────
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write to the request so subsequent reads in this middleware see them
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Rebuild supabaseResponse so it carries the updated request cookies
          supabaseResponse = NextResponse.next({ request });
          // Also set on the outgoing response so the browser receives them
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // ─── Auth code exchange (PKCE flow) ───────────────────────────────────────
  // Google/Supabase redirects here with ?code=... after OAuth consent.
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    // Build redirect to /dashboard (or back to / on error)
    const url = request.nextUrl.clone();
    url.searchParams.delete("code");

    if (!error) {
      url.pathname = "/dashboard";
    } else {
      console.error("Auth code exchange failed:", error.message);
      url.pathname = "/";
      url.searchParams.set("error", "auth");
    }

    // CRITICAL: Copy session cookies from supabaseResponse onto the redirect.
    // exchangeCodeForSession() calls setAll() which writes cookies to
    // supabaseResponse, but we're returning a redirect instead — so we must
    // transfer those cookies or the session is lost.
    const redirect = NextResponse.redirect(url);
    supabaseResponse.cookies.getAll().forEach((cookie) => {
      redirect.cookies.set(cookie.name, cookie.value, {
        // Preserve the options that Supabase SSR sets
        path: "/",
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 365, // 1 year
      });
    });
    return redirect;
  }

  // ─── Session refresh ──────────────────────────────────────────────────────
  // getUser() validates the JWT and refreshes the session if needed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Protect /dashboard — redirect to login if no session
  if (!user && request.nextUrl.pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  // If logged in and on login page, redirect to dashboard
  if (user && request.nextUrl.pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
