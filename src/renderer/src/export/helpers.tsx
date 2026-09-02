import { Check, FolderOpen } from 'lucide-react'
import { useEffect, useRef, useState, type JSX } from 'react'
import { isApiError } from '../../../shared/api-error'

const SUCCESS_SHOW_MS = 10000
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
  filePath,
  onDismiss
}: {
  message: string
  filePath: string
  onDismiss: () => void
}): JSX.Element {
  const [shown, setShown] = useState(false)
  const [openError, setOpenError] = useState<string | null>(null)
  const onDismissRef = useRef(onDismiss)
  onDismissRef.current = onDismiss
  const exitIdRef = useRef<number | null>(null)
  const dismissIdRef = useRef<number | null>(null)
  const pausedRef = useRef(false)
  const showDeadlineRef = useRef(0)
  const dismissDeadlineRef = useRef(0)

  function clearTimers(): void {
    if (exitIdRef.current != null) {
      window.clearTimeout(exitIdRef.current)
      exitIdRef.current = null
    }
    if (dismissIdRef.current != null) {
      window.clearTimeout(dismissIdRef.current)
      dismissIdRef.current = null
    }
  }

  function scheduleTimers(): void {
    clearTimers()
    const now = Date.now()
    const exitMs = Math.max(0, showDeadlineRef.current - now)
    const dismissMs = Math.max(0, dismissDeadlineRef.current - now)
    if (exitMs > 0) {
      exitIdRef.current = window.setTimeout(() => {
        exitIdRef.current = null
        setShown(false)
      }, exitMs)
    } else {
      setShown(false)
    }
    if (dismissMs > 0) {
      dismissIdRef.current = window.setTimeout(() => {
        dismissIdRef.current = null
        onDismissRef.current()
      }, dismissMs)
    } else {
      onDismissRef.current()
    }
  }

  function pauseTimers(): void {
    if (pausedRef.current) {
      return
    }
    pausedRef.current = true
    clearTimers()
  }

  function resumeTimers(): void {
    if (!pausedRef.current) {
      return
    }
    pausedRef.current = false
    scheduleTimers()
  }

  useEffect(() => {
    setShown(false)
    setOpenError(null)
    pausedRef.current = false
    const now = Date.now()
    showDeadlineRef.current = now + SUCCESS_SHOW_MS
    dismissDeadlineRef.current = now + SUCCESS_SHOW_MS + SUCCESS_EXIT_MS
    const enterId = window.requestAnimationFrame(() => setShown(true))
    scheduleTimers()
    return () => {
      window.cancelAnimationFrame(enterId)
      clearTimers()
    }
  }, [message])

  function onOpenFolder(): void {
    void window.api.showItemInFolder(filePath).then(
      () => onDismissRef.current(),
      (cause: unknown) => setOpenError(errorMessage(cause))
    )
  }

  return (
    <div
      role="status"
      onMouseEnter={pauseTimers}
      onMouseLeave={resumeTimers}
      className={[
        'flex items-center gap-2 rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 transition duration-200 ease-out',
        shown ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'
      ].join(' ')}
    >
      <Check size={16} className="shrink-0 text-emerald-600" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">Aksi berhasil</p>
        <p className="mt-0.5 break-all text-emerald-700">{message}</p>
        {openError ? <p className="mt-0.5 text-red-700">{openError}</p> : null}
      </div>
      <button
        type="button"
        className="shrink-0 rounded p-1 text-emerald-700 hover:bg-emerald-100"
        aria-label="Buka di penjelajah file"
        title="Buka di penjelajah file"
        onClick={onOpenFolder}
      >
        <FolderOpen size={18} aria-hidden="true" />
      </button>
    </div>
  )
}
