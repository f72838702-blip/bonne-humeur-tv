import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "@/lib/supabase/public-config";
import { hardenedCookieOptions, isLocalhostHost } from "@/lib/supabase/cookies";

/**
 * Garde UX pour /admin : redirige vers la page de connexion si aucune
 * session n'existe. CE N'EST PAS un contrôle d'accès : chaque page et
 * Server Action du back-office revérifie la session ET le rôle
 * (lib/auth/session.ts + RLS en base). Sans backend configuré, on
 * laisse passer : les pages affichent l'état « non configuré ».
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!pathname.startsWith("/admin") || pathname.startsWith("/admin/login")) {
    return NextResponse.next();
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Durcissement sécurité E1 : httpOnly/secure/sameSite forcés
        // (les défauts de @supabase/ssr posent httpOnly:false).
        // 1) propagation aux cookies de la REQUÊTE (sessions rafraîchies
        //    visibles par le handler — pattern officiel @supabase/ssr) ;
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        // 2) pose/réponse : même cookies, attributs durcis.
        const isLocal = isLocalhostHost(request.nextUrl.hostname);
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, hardenedCookieOptions(options, isLocal))
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};