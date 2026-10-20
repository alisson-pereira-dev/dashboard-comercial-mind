import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { runtimeEnv } from '@/lib/env'

// Cliente do usuário logado (respeita RLS). Para Server Components e Server Actions.
export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    runtimeEnv('NEXT_PUBLIC_SUPABASE_URL')!,
    runtimeEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY')!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Chamado de um Server Component: o proxy já renova a sessão.
          }
        },
      },
    },
  )
}
