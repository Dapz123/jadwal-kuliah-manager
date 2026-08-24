import { useEffect, useState, type JSX } from 'react'
import type { Jadwal, Kurikulum, ProgramStudi, Semester } from '../../../shared/api'
import { gelarExportWarning } from '../../../shared/dosen-nama'
import { Banner, PageShell, PageTabs, WarningBanner, primaryBtn } from '../chrome'
import { exportCompletenessBanner } from './completeness'
import ExportBebanPanel from './ExportBebanPanel'
import { errorMessage, StatusBanner, SuccessBanner } from './helpers'

const EXPORT_TABS = [
  { id: 'lembar' as const, label: 'Lembar Jadwal' },
  { id: 'rekap' as const, label: 'Rekap Beban Dosen' }
]

type ExportTab = (typeof EXPORT_TABS)[number]['id']
type ProgramStudiFilter = number | 'all' | null

const DESCRIPTION: Record<ExportTab, string> = {
  lembar:
    'Unduh XLSX satu atau beberapa Jadwal (satu sheet per Jadwal), termasuk seluruh Prodi untuk satu Tahun Akademik dan Semester.',
  rekap: 'Unduh XLSX rekap penugasan dosen (satu baris per Kelas, Total SKS per dosen) untuk Tahun Akademik dan Semester terpilih.'
}

export default function ExportPage(): JSX.Element {
  const [tab, setTab] = useState<ExportTab>('lembar')
  const [prodi, setProdi] = useState<ProgramStudi[] | null>(null)
  const [programStudiId, setProgramStudiId] = useState<ProgramStudiFilter>(null)
  const [tahunOptions, setTahunOptions] = useState<string[] | null>(null)
  const [tahunAkademik, setTahunAkademik] = useState('')
  const [semester, setSemester] = useState<Semester>('Ganjil')
  const [jadwal, setJadwal] = useState<Jadwal[]>([])
  const [kurikulum, setKurikulum] = useState<Kurikulum[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [completeness, setCompleteness] = useState<string | null>(null)
  const [actionBanner, setActionBanner] = useState<string | null>(null)
  const [actionFailed, setActionFailed] = useState(false)
  const [gelarWarning, setGelarWarning] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [loadingJadwal, setLoadingJadwal] = useState(false)

  const seluruh = programStudiId === 'all'

  useEffect(() => {
    void window.api.listProgramStudi().then(
      (rows) => {
        setProdi(rows)
        setError(null)
      },
      (cause: unknown) => setError(errorMessage(cause))
    )
  }, [])

  useEffect(() => {
    if (!seluruh) {
      return
    }
    let cancelled = false
    void window.api.listTahunAkademik().then(
      (list) => {
        if (cancelled) {
          return
        }
        setTahunOptions(list)
        setTahunAkademik((current) =>
          current && list.includes(current) ? current : (list[0] ?? '')
        )
        setError(null)
      },
      (cause: unknown) => {
        if (!cancelled) {
          setError(errorMessage(cause))
        }
      }
    )
    return () => {
      cancelled = true
    }
  }, [seluruh])

  useEffect(() => {
    if (programStudiId == null || prodi == null) {
      setJadwal([])
      setKurikulum([])
      setLoadingJadwal(false)
      return
    }
    if (programStudiId === 'all') {
      if (!tahunAkademik) {
        setJadwal([])
        setKurikulum([])
        setLoadingJadwal(false)
        return
      }
      let cancelled = false
      setLoadingJadwal(true)
      const kodeById = new Map(prodi.map((row) => [row.id, row.kode]))
      void Promise.all(
        prodi.map(async (row) => {
          const [jadwalRows, kurikulumRows] = await Promise.all([
            window.api.listJadwal(row.id),
            window.api.listKurikulum(row.id)
          ])
          return {
            jadwal: jadwalRows.filter(
              (item) => item.tahunAkademik === tahunAkademik && item.semester === semester
            ),
            kurikulum: kurikulumRows
          }
        })
      ).then(
        (groups) => {
          if (cancelled) {
            return
          }
          const jadwalRows = groups
            .flatMap((group) => group.jadwal)
            .sort(
              (a, b) =>
                (kodeById.get(a.programStudiId) ?? '').localeCompare(
                  kodeById.get(b.programStudiId) ?? ''
                ) ||
                a.jenisKelas.localeCompare(b.jenisKelas) ||
                a.id - b.id
            )
          setJadwal(jadwalRows)
          setKurikulum(groups.flatMap((group) => group.kurikulum))
          setSelectedIds(jadwalRows.map((row) => row.id))
          setLoadingJadwal(false)
          setError(null)
        },
        (cause: unknown) => {
          if (!cancelled) {
            setError(errorMessage(cause))
            setLoadingJadwal(false)
          }
        }
      )
      return () => {
        cancelled = true
      }
    }

    let cancelled = false
    setLoadingJadwal(false)
    void Promise.all([
      window.api.listJadwal(programStudiId),
      window.api.listKurikulum(programStudiId)
    ]).then(
      ([jadwalRows, kurikulumRows]) => {
        if (cancelled) {
          return
        }
        setJadwal(jadwalRows)
        setKurikulum(kurikulumRows)
        setError(null)
      },
      (cause: unknown) => {
        if (!cancelled) {
          setError(errorMessage(cause))
        }
      }
    )
    return () => {
      cancelled = true
    }
  }, [programStudiId, tahunAkademik, semester, prodi])

  useEffect(() => {
    if (selectedIds.length !== 1) {
      setCompleteness(null)
      return
    }
    const selectedId = selectedIds[0]
    let cancelled = false
    setCompleteness(null)
    void Promise.all([
      window.api.listJadwalSnapshots(selectedId),
      window.api.listKelas(selectedId),
      window.api.listBentrok(selectedId)
    ]).then(
      ([snapshots, kelas, bentrok]) => {
        if (!cancelled) {
          setCompleteness(exportCompletenessBanner(snapshots, kelas, bentrok))
        }
      },
      (cause: unknown) => {
        if (!cancelled) {
          setError(errorMessage(cause))
        }
      }
    )
    return () => {
      cancelled = true
    }
  }, [selectedIds])

  if (prodi == null) {
    return (
      <PageShell title="Export" description={DESCRIPTION[tab]}>
        {error ? <Banner message={error} /> : null}
      </PageShell>
    )
  }

  const kurikulumNama = new Map(kurikulum.map((row) => [row.id, row.nama]))
  const prodiNama = new Map(prodi.map((row) => [row.id, row.nama]))
  const unduhEnabled = selectedIds.length > 0 && !downloading
  const selectedSet = new Set(selectedIds)

  function toggleSelected(id: number): void {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]
    )
  }

  function onUnduh(): void {
    if (selectedIds.length === 0 || downloading) {
      return
    }
    setDownloading(true)
    void window.api.exportJadwalXlsx(selectedIds).then(
      (result) => {
        setDownloading(false)
        if ('canceled' in result && result.canceled) {
          return
        }
        if ('path' in result) {
          setActionFailed(false)
          setActionBanner(`Tersimpan: ${result.path}`)
          setGelarWarning(gelarExportWarning(result.gelarWarnings))
        }
      },
      (cause: unknown) => {
        setDownloading(false)
        setActionFailed(true)
        setActionBanner(errorMessage(cause))
      }
    )
  }

  function onProgramStudiChange(value: string): void {
    setSelectedIds([])
    if (value === '') {
      setProgramStudiId(null)
      return
    }
    if (value === 'all') {
      setProgramStudiId('all')
      return
    }
    setProgramStudiId(Number(value))
  }

  const selectValue =
    programStudiId == null ? '' : programStudiId === 'all' ? 'all' : String(programStudiId)

  return (
    <PageShell title="Export" description={DESCRIPTION[tab]}>
      <div className="space-y-4">
        <PageTabs tabs={EXPORT_TABS} value={tab} onChange={setTab} />

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === 'rekap' ? (
            <ExportBebanPanel prodi={prodi} />
          ) : prodi.length === 0 && !error ? (
            <p className="text-slate-600">Buat Program Studi dulu</p>
          ) : (
            <div className="space-y-4">
              {error ? <Banner message={error} /> : null}
              {completeness ? <StatusBanner message={completeness} /> : null}
              {actionBanner ? (
                actionFailed ? (
                  <Banner message={actionBanner} />
                ) : (
                  <SuccessBanner
                    message={actionBanner}
                    onDismiss={() => setActionBanner(null)}
                  />
                )
              ) : null}
              {gelarWarning ? <WarningBanner message={gelarWarning} /> : null}

              <div className="flex flex-wrap items-end gap-4">
                <label className="flex min-w-48 shrink-0 flex-col gap-1 text-sm text-slate-700">
                  Program Studi
                  <select
                    className="rounded border border-slate-300 pl-3 pr-9 py-2"
                    aria-label="Program Studi"
                    value={selectValue}
                    onChange={(event) => onProgramStudiChange(event.target.value)}
                  >
                    <option value="">Pilih Program Studi</option>
                    <option value="all">Seluruh Prodi</option>
                    {prodi.map((row) => (
                      <option key={row.id} value={row.id}>
                        {row.kode} — {row.nama}
                      </option>
                    ))}
                  </select>
                </label>
                {seluruh && tahunOptions != null && tahunOptions.length > 0 ? (
                  <>
                    <label className="flex min-w-48 shrink-0 flex-col gap-1 text-sm text-slate-700">
                      Tahun Akademik
                      <select
                        className="rounded border border-slate-300 pl-3 pr-9 py-2"
                        aria-label="Tahun Akademik"
                        value={tahunAkademik}
                        onChange={(event) => setTahunAkademik(event.target.value)}
                      >
                        {tahunOptions.map((tahun) => (
                          <option key={tahun} value={tahun}>
                            {tahun}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="flex min-w-40 shrink-0 flex-col gap-1 text-sm text-slate-700">
                      Semester
                      <select
                        className="rounded border border-slate-300 pl-3 pr-9 py-2"
                        aria-label="Semester"
                        value={semester}
                        onChange={(event) => setSemester(event.target.value as Semester)}
                      >
                        <option value="Ganjil">Ganjil</option>
                        <option value="Genap">Genap</option>
                      </select>
                    </label>
                  </>
                ) : null}
                <button
                  type="button"
                  className={`${primaryBtn} ml-auto shrink-0`}
                  disabled={!unduhEnabled}
                  onClick={onUnduh}
                >
                  Unduh
                </button>
              </div>

              {seluruh ? (
                tahunOptions == null ? (
                  <p className="text-slate-600">Memuat…</p>
                ) : tahunOptions.length === 0 ? (
                  <p className="text-slate-600">Belum ada Jadwal — tidak ada Tahun Akademik.</p>
                ) : loadingJadwal ? (
                  <p className="text-slate-600">Memuat…</p>
                ) : jadwal.length === 0 ? (
                  <p className="text-slate-600">Belum ada Jadwal untuk filter ini.</p>
                ) : (
                  <LembarJadwalTable
                    seluruh
                    jadwal={jadwal}
                    selectedSet={selectedSet}
                    kurikulumNama={kurikulumNama}
                    prodiNama={prodiNama}
                    onToggle={toggleSelected}
                  />
                )
              ) : programStudiId == null ? null : jadwal.length === 0 ? (
                <p className="text-slate-600">Belum ada Jadwal</p>
              ) : (
                <LembarJadwalTable
                  seluruh={false}
                  jadwal={jadwal}
                  selectedSet={selectedSet}
                  kurikulumNama={kurikulumNama}
                  prodiNama={prodiNama}
                  onToggle={toggleSelected}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  )
}

function LembarJadwalTable({
  seluruh,
  jadwal,
  selectedSet,
  kurikulumNama,
  prodiNama,
  onToggle
}: {
  seluruh: boolean
  jadwal: Jadwal[]
  selectedSet: Set<number>
  kurikulumNama: Map<number, string>
  prodiNama: Map<number, string>
  onToggle: (id: number) => void
}): JSX.Element {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            <th className="w-px px-2 py-2 font-medium">
              <span className="sr-only">Pilih</span>
            </th>
            {seluruh ? (
              <th className="px-2 py-2 font-medium">Program Studi</th>
            ) : (
              <>
                <th className="px-2 py-2 font-medium">Tahun Akademik</th>
                <th className="px-2 py-2 font-medium">Semester</th>
              </>
            )}
            <th className="px-2 py-2 font-medium">Jenis Kelas</th>
            <th className="px-2 py-2 font-medium">Kurikulum</th>
          </tr>
        </thead>
        <tbody>
          {jadwal.map((row) => {
            const selected = selectedSet.has(row.id)
            const checkboxId = `export-jadwal-${row.id}`
            const prodiLabel = prodiNama.get(row.programStudiId) ?? ''
            return (
              <tr
                key={row.id}
                className={['border-b border-slate-100', selected ? 'bg-slate-50' : ''].join(' ')}
              >
                <td className="w-px px-2 py-2">
                  <input
                    id={checkboxId}
                    type="checkbox"
                    className="size-4 rounded border-slate-300"
                    checked={selected}
                    aria-label={
                      seluruh
                        ? `Pilih Jadwal ${prodiLabel} ${row.jenisKelas}`
                        : `Pilih Jadwal ${row.tahunAkademik} ${row.semester} ${row.jenisKelas}`
                    }
                    onChange={() => onToggle(row.id)}
                  />
                </td>
                {seluruh ? (
                  <td className="px-2 py-2 text-slate-800">{prodiLabel}</td>
                ) : (
                  <>
                    <td className="px-2 py-2 text-slate-800">{row.tahunAkademik}</td>
                    <td className="px-2 py-2 text-slate-800">{row.semester}</td>
                  </>
                )}
                <td className="px-2 py-2 text-slate-800">{row.jenisKelas}</td>
                <td className="px-2 py-2 text-slate-800">
                  {kurikulumNama.get(row.kurikulumId) ?? ''}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
