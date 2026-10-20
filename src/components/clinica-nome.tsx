import { Suspense } from 'react'
import { connection } from 'next/server'
import { runtimeEnv } from '@/lib/env'

async function Nome({ className }: { className: string }) {
  // Sem isso o nome seria lido no build e ficaria gravado na página pré-renderizada.
  await connection()
  const clinica = runtimeEnv('NEXT_PUBLIC_CLINIC_NAME')
  return clinica ? <p className={className}>{clinica}</p> : null
}

// Nome da clínica (variável NEXT_PUBLIC_CLINIC_NAME), lido a cada pedido.
export function ClinicaNome({ className }: { className: string }) {
  return (
    <Suspense fallback={null}>
      <Nome className={className} />
    </Suspense>
  )
}
