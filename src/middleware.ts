import { type NextRequest, NextResponse } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { pageKeyForPath, canViewPath } from "@/lib/permissions";
import { resolveRole } from "@/lib/roles";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Middleware: refresh sesi Supabase & (nanti) set brand-context untuk RLS.
 * Aman berjalan tanpa env Supabase (mode scaffold) — langsung passthrough.
 */
export async function middleware(request: NextRequest) {
  const response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response; // belum dikonfigurasi -> lewati

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: CookieToSet[]) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // Menyegarkan token bila perlu.
  const { data: { user } } = await supabase.auth.getUser();

  // Penjaga akses per-halaman (RBAC). Rute tak-terjaga (login/print) → dibiarkan.
  const pageKey = pageKeyForPath(request.nextUrl.pathname);
  if (pageKey && user) {
    const role = await resolveRole(supabase, user.id);
    if (!canViewPath(role, request.nextUrl.pathname)) {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
