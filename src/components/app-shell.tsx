import { LogOut } from 'lucide-react'
import { signOut } from '@/app/login/actions'
import { NavLinks } from './nav-links'

function Brand() {
  const clinica = process.env.NEXT_PUBLIC_CLINIC_NAME
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className="flex size-10 items-center justify-center rounded-xl bg-navy text-base font-bold text-brand-alt"
      >
        M
      </span>
      <div className="min-w-0 leading-tight">
        <p className="text-sm font-semibold text-navy">Mindsight</p>
        {clinica ? <p className="truncate text-xs text-muted">{clinica}</p> : null}
      </div>
    </div>
  )
}

function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="flex w-full items-center gap-3 rounded-full px-4 py-2.5 text-sm font-medium text-muted transition-colors duration-200 hover:bg-black/[0.04] hover:text-navy"
      >
        <LogOut aria-hidden className="size-[18px]" />
        Sair
      </button>
    </form>
  )
}

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen lg:flex lg:gap-6 lg:p-6">
      {/* Menu lateral (telas grandes) */}
      <aside className="card sticky top-6 hidden h-[calc(100vh-3rem)] w-64 shrink-0 flex-col p-4 lg:flex">
        <div className="rounded-2xl border border-border p-3">
          <Brand />
        </div>
        <div className="mt-6">
          <NavLinks direction="vertical" />
        </div>
        <div className="mt-auto border-t border-border pt-3">
          <SignOutButton />
        </div>
      </aside>

      {/* Barra superior (telas pequenas) */}
      <header className="card m-4 flex flex-wrap items-center justify-between gap-3 p-3 lg:hidden">
        <Brand />
        <div className="flex items-center gap-1">
          <NavLinks direction="horizontal" />
          <SignOutButton />
        </div>
      </header>

      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
