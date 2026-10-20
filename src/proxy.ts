import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { runtimeEnv } from '@/lib/env'

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    runtimeEnv('NEXT_PUBLIC_SUPABASE_URL')!,
    runtimeEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // getClaims valida o token localmente (assinatura e validade) e só renova a sessão quando
  // preciso. getUser iria ao Supabase Auth a cada navegação (cerca de 100 ms cada).
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims ?? null

  const isLogin = request.nextUrl.pathname === '/login'

  if (!user && !isLogin) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (user && isLogin) {
    return NextResponse.redirect(new URL('/', request.url))
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
