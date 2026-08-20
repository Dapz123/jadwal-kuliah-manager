import { Check } from 'lucide-react'
import { useEffect, useRef, useState, type JSX } from 'react'
import { isApiError } from '../../../shared/api-error'

const SUCCESS_SHOW_MS = 5000
const SUCCESS_EXIT_MS = 200

export function errorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Terjadi kesalahan'
}

export function StatusBanner({ message }: { message: string }): JSX.Element {
  return (
    <p
      role="status"
      className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800"
    >
      {message}
    </p>
  )
}

export function SuccessBanner({
  message,
  onDismiss
}: {
  message: string
  onDismiss: () => void
}): JSX.Element {
  const [shown, setShown] = useState(false)
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss

  useEffect(() => {
    setShown(false)
    const enterId = window.requestAnimationFrame(() => setShown(true))
    const exitId = window.setTimeout(() => setShown(false), SUCCESS_SHOW_MS)
    const dismissId = window.setTimeout(() => onDismissRef.current(), SUCCESS_SHOW_MS + SUCCESS_EXIT_MS)
    return () => {
      window.cancelAnimationFrame(enterId)
      window.clearTimeout(exitId)
      window.clearTimeout(dismissId)
    }
  }, [message])

  return (
    <div
      role="status"
      className={[
        'flex items-start gap-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 transition duration-200 ease-out',
        shown ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'
      ].join(' ')}
    >
      <Check size={16} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
      <div className="min-w-0">
        <p className="font-medium">Aksi berhasil</p>
        <p className="mt-0.5 break-all text-emerald-700">{message}</p>
      </div>
    </div>
  )
}
