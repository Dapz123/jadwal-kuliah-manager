import type { JSX, ReactNode } from 'react'

export const primaryBtn =
  'rounded bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-40'
export const saveBtn = primaryBtn
export const secondaryBtn = 'rounded px-3 py-2 text-sm text-slate-700 hover:bg-slate-100'
export const dangerBtn = 'rounded bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700'
export const actionBtn =
  'rounded border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50'
export const actionDangerBtn =
  'rounded border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100'

export function Banner({ message }: { message: string }): JSX.Element {
  return (
    <p
      role="alert"
      className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800"
    >
      {message}
    </p>
  )
}

export function PageShell({
  title,
  description,
  action,
  children
}: {
  title: string
  description: string
  action?: ReactNode
  children: ReactNode
}): JSX.Element {
  return (
    <section className="p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      <div className="mt-6">{children}</div>
    </section>
  )
}

export function PageTabs<T extends string>({
  tabs,
  value,
  onChange
}: {
  tabs: { id: T; label: string }[]
  value: T
  onChange: (id: T) => void
}): JSX.Element {
  return (
    <div className="flex gap-6 border-b border-slate-200" role="tablist">
      {tabs.map((tab) => {
        const active = tab.id === value
        return (
          <button
            key={tab.id}
            id={`tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`panel-${tab.id}`}
            className={[
              '-mb-px border-b-2 pb-2 text-sm',
              active
                ? 'border-accent font-semibold text-accent'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            ].join(' ')}
            onClick={() => onChange(tab.id)}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

export function Dialog({
  title,
  children,
  footer
}: {
  title: string
  children: ReactNode
  footer: ReactNode
}): JSX.Element {
  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        className="w-full max-w-md rounded-lg bg-white p-4 shadow-lg"
      >
        <h2 id="dialog-title" className="text-lg font-semibold text-slate-900">
          {title}
        </h2>
        <div className="mt-3 space-y-3">{children}</div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">{footer}</div>
      </div>
    </div>
  )
}

export function CatalogList<T extends { id: number }>({
  entity,
  filter,
  onFilter,
  onAdd,
  addLabel = 'Tambah',
  listError,
  catalogEmpty,
  rows,
  title,
  sublabel,
  meta,
  onEdit,
  onDelete,
  selectedId,
  onSelect
}: {
  entity: string
  filter: string
  onFilter: (value: string) => void
  onAdd: () => void
  addLabel?: string
  listError: string | null
  catalogEmpty: boolean
  rows: T[]
  title: (row: T) => string
  sublabel: (row: T) => string
  meta?: (row: T) => ReactNode
  onEdit?: (row: T) => void
  onDelete: (row: T) => void
  selectedId?: number | null
  onSelect?: (row: T) => void
}): JSX.Element {
  return (
    <div className="space-y-3">
      {listError ? <Banner message={listError} /> : null}
      <input
        className="w-full max-w-md rounded border border-slate-300 px-3 py-1.5 text-sm"
        placeholder="Pencarian"
        value={filter}
        onChange={(event) => onFilter(event.target.value)}
        aria-label={`Pencarian ${entity}`}
      />
      {catalogEmpty ? (
        <p className="text-slate-600">
          Belum ada {entity}{' '}
          <button type="button" className="underline" onClick={onAdd}>
            {addLabel}
          </button>
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {rows.map((row) => (
            <li
              key={row.id}
              className={[
                'flex items-center gap-3 py-3',
                onSelect ? 'cursor-pointer hover:bg-slate-50' : '',
                selectedId === row.id ? 'bg-slate-50' : ''
              ].join(' ')}
              onClick={onSelect ? () => onSelect(row) : undefined}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-slate-900">{title(row)}</p>
                <p className="truncate text-sm text-slate-500">{sublabel(row)}</p>
              </div>
              {meta ? <div className="shrink-0">{meta(row)}</div> : null}
              <div
                className="flex shrink-0 gap-1"
                onClick={(event) => event.stopPropagation()}
              >
                {onSelect ? (
                  <button type="button" className={actionBtn} onClick={() => onSelect(row)}>
                    Pilih
                  </button>
                ) : null}
                {onEdit ? (
                  <button type="button" className={actionBtn} onClick={() => onEdit(row)}>
                    Ubah
                  </button>
                ) : null}
                <button type="button" className={actionDangerBtn} onClick={() => onDelete(row)}>
                  Hapus
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
