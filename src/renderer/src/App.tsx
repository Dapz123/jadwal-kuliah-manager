import {
  BookOpen,
  CalendarDays,
  ChevronDown,
  ClipboardList,
  Clock,
  Download,
  Library,
  PanelLeftClose,
  PanelLeftOpen,
  School,
  Users
} from 'lucide-react'
import { useEffect, useRef, useState, type JSX, type ReactNode } from 'react'
import { HashRouter, Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom'
import BebanDosenPage from './beban-dosen/BebanDosenPage'
import ExportPage from './export/ExportPage'
import JadwalPage from './jadwal/JadwalPage'
import {
  DosenPage,
  KurikulumPage,
  MataKuliahPage,
  ProgramStudiPage,
  WaktuSksPage
} from './master-data/MasterDataPage'
import { DEFAULT_PATH, NAV_ITEMS, navGroupOpen, navLeaves } from './nav'

const LEAF_ICONS = {
  '/mata-kuliah': BookOpen,
  '/dosen': Users,
  '/kurikulum': Library,
  '/jadwal': CalendarDays,
  '/beban-dosen': ClipboardList,
  '/program-studi': School,
  '/waktu-sks': Clock,
  '/export': Download
} as const

function Placeholder({ title }: { title: string }): JSX.Element {
  return (
    <section className="p-8">
      <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
      <p className="mt-2 text-slate-600">Halaman ini belum berisi data.</p>
    </section>
  )
}

function pageFor(path: string, label: string): JSX.Element {
  if (path === '/mata-kuliah') {
    return <MataKuliahPage />
  }
  if (path === '/dosen') {
    return <DosenPage />
  }
  if (path === '/kurikulum') {
    return <KurikulumPage />
  }
  if (path === '/jadwal') {
    return <JadwalPage />
  }
  if (path === '/beban-dosen') {
    return <BebanDosenPage />
  }
  if (path === '/program-studi') {
    return <ProgramStudiPage />
  }
  if (path === '/waktu-sks') {
    return <WaktuSksPage />
  }
  if (path === '/export') {
    return <ExportPage />
  }
  return <Placeholder title={label} />
}

function SidebarLink({
  path,
  label,
  collapsed,
  indent
}: {
  path: string
  label: string
  collapsed: boolean
  indent?: boolean
}): JSX.Element {
  const Icon = LEAF_ICONS[path as keyof typeof LEAF_ICONS]
  return (
    <NavLink
      to={path}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
      className={({ isActive }) =>
        [
          'flex items-center gap-2 overflow-hidden whitespace-nowrap rounded px-2 py-2 text-sm',
          indent && !collapsed ? 'pl-7' : '',
          isActive
            ? 'bg-accent/15 font-medium text-accent'
            : 'text-slate-700 hover:bg-slate-100'
        ].join(' ')
      }
    >
      <Icon size={16} className="shrink-0" aria-hidden="true" />
      <span
        aria-hidden={collapsed}
        className={[
          'transition-opacity duration-150',
          collapsed ? 'opacity-0' : 'opacity-100'
        ].join(' ')}
      >
        {label}
      </span>
    </NavLink>
  )
}

function Sidebar({
  collapsed,
  onToggle
}: {
  collapsed: boolean
  onToggle: () => void
}): JSX.Element {
  const location = useLocation()
  const [toggled, setToggled] = useState<Record<string, boolean>>({})

  return (
    <nav
      id="app-sidebar"
      className={[
        'flex h-full shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-slate-50 p-2 transition-[width] duration-200 ease-out',
        collapsed ? 'w-12' : 'w-56'
      ].join(' ')}
      aria-label="Navigasi utama"
    >
      <div className="flex min-h-9 shrink-0 items-center gap-1">
        <button
          type="button"
          aria-expanded={!collapsed}
          aria-controls="app-sidebar"
          title={collapsed ? 'Perbesar sidebar' : 'Perkecil sidebar'}
          className="shrink-0 rounded p-1.5 text-slate-500 hover:bg-slate-100"
          onClick={onToggle}
        >
          {collapsed ? (
            <PanelLeftOpen size={16} aria-hidden="true" />
          ) : (
            <PanelLeftClose size={16} aria-hidden="true" />
          )}
        </button>
        <p
          className={[
            'min-w-0 flex-1 truncate text-sm font-semibold text-slate-500 transition-opacity duration-150',
            collapsed ? 'opacity-0' : 'opacity-100'
          ].join(' ')}
        >
          Jadwal Kuliah
        </p>
      </div>
      <div className="mt-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
        {NAV_ITEMS.map((item, index) => {
          const childPaths = item.children.map((child) => child.path)
          const open = navGroupOpen(toggled[item.label], childPaths, location.pathname)
          return (
            <div key={item.label} className="flex flex-col gap-1">
              {collapsed ? (
                index === 0 ? null : (
                  <div
                    role="separator"
                    aria-label={item.label}
                    title={item.label}
                    className="mx-auto my-1 h-px w-5 bg-slate-300"
                  />
                )
              ) : (
                <button
                  type="button"
                  aria-expanded={open}
                  className="flex items-center gap-2 overflow-hidden whitespace-nowrap rounded px-2 py-1.5 text-xs font-medium uppercase tracking-wide text-slate-500 hover:bg-slate-100"
                  onClick={() =>
                    setToggled((current) => ({ ...current, [item.label]: !open }))
                  }
                >
                  <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                  <ChevronDown
                    size={14}
                    aria-hidden="true"
                    className={[
                      'shrink-0 text-slate-400 transition-transform duration-150',
                      open ? '' : '-rotate-90'
                    ].join(' ')}
                  />
                </button>
              )}
              {open || collapsed
                ? item.children.map((child) => (
                    <SidebarLink
                      key={child.path}
                      path={child.path}
                      label={child.label}
                      collapsed={collapsed}
                      indent
                    />
                  ))
                : null}
            </div>
          )
        })}
      </div>
    </nav>
  )
}

function Main({ children }: { children: ReactNode }): JSX.Element {
  const { pathname } = useLocation()
  const mainRef = useRef<HTMLElement>(null)

  useEffect(() => {
    mainRef.current?.scrollTo(0, 0)
  }, [pathname])

  return (
    <main ref={mainRef} className="min-h-0 min-w-0 flex-1 overflow-y-auto bg-white">
      {children}
    </main>
  )
}

function App(): JSX.Element {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <HashRouter>
      <div className="flex h-screen overflow-hidden bg-white text-slate-900">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
        <Main>
          <Routes>
            <Route path="/" element={<Navigate to={DEFAULT_PATH} replace />} />
            <Route path="/master-data" element={<Navigate to={DEFAULT_PATH} replace />} />
            {navLeaves().map((item) => (
              <Route
                key={item.path}
                path={item.path}
                element={pageFor(item.path, item.label)}
              />
            ))}
          </Routes>
        </Main>
      </div>
    </HashRouter>
  )
}

export default App
