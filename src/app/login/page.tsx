import { Suspense } from 'react'
import { signIn } from './actions'

type SearchParams = Promise<{ erro?: string }>

export default function LoginPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<LoginForm />}>
      <LoginWithParams searchParams={searchParams} />
    </Suspense>
  )
}

async function LoginWithParams({ searchParams }: { searchParams: SearchParams }) {
  const { erro } = await searchParams
  return <LoginForm erro={Boolean(erro)} />
}

function LoginForm({ erro = false }: { erro?: boolean }) {
  const clinica = process.env.NEXT_PUBLIC_CLINIC_NAME

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <form
        action={signIn}
        className="card w-full max-w-sm p-8"
      >
        <span aria-hidden className="flex size-10 items-center justify-center rounded-xl bg-navy text-base font-bold text-brand-alt">M</span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight text-navy">Dashboard comercial</h1>
        {clinica ? <p className="mt-1 text-sm text-muted">{clinica}</p> : null}

        <label className="mt-6 block text-sm font-medium text-navy" htmlFor="email">
          E-mail
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="input mt-1"
        />

        <label className="mt-4 block text-sm font-medium text-navy" htmlFor="password">
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="input mt-1"
        />

        {erro ? (
          <p role="alert" className="mt-4 text-sm text-status-abaixo">
            E-mail ou senha incorretos.
          </p>
        ) : null}

        <button
          type="submit"
          className="btn btn-dark mt-6 w-full"
        >
          Entrar
        </button>
      </form>
    </main>
  )
}
