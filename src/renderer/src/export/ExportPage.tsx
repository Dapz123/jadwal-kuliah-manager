import { useEffect, useState, type JSX } from 'react'
import type { Jadwal, Kurikulum, ProgramStudi } from '../../../shared/api'
import { Banner, PageShell, PageTabs, actionBtn, primaryBtn } from '../chrome'
import { exportCompletenessBanner } from './completeness'
import ExportBebanPanel from './ExportBebanPanel'
import { errorMessage, StatusBanner, SuccessBanner } from './helpers'

const EXPORT_TABS = [
  { id: 'lembar' as const, label: 'Lembar Jadwal' },
  { id: 'rekap' as const, label: 'Rekap Beban Dosen' }
]

type ExportTab = (typeof EXPORT_TABS)[number]['id']

const DESCRIPTION: Record<ExportTab, string> = {
  lembar: 'Unduh XLSX satu atau beberapa Jadwal (satu sheet per Jadwal).',
  rekap: 'Unduh XLSX rekap penugasan dosen (satu baris per Kelas, Total SKS per dosen) untuk Tahun Akademik dan Semester terpilih.'
}

export default function ExportPage(): JSX.Element {
  const [tab, setTab] = useState<ExportTab>('lembar')
  const [prodi, setProdi] = useState<ProgramStudi[] | null>(null)
  const [programStudiId, setProgramStudiId] = useState<number | null>(null)
  const [jadwal, setJadwal] = useState<Jadwal[]>([])
  const [kurikulum, setKurikulum] = useState<Kurikulum[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [completeness, setCompleteness] = useState<string | null>(null)
  const [actionBanner, setActionBanner] = useState<string | null>(null)
  const [actionFailed, setActionFailed] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

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
    if (programStudiId == null) {
      setJadwal([])
      setKurikulum([])
      return
    }
    let cancelled = false
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
  }, [programStudiId])

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
        }
      },
      (cause: unknown) => {
        setDownloading(false)
        setActionFailed(true)
        setActionBanner(errorMessage(cause))
      }
    )
  }

  return (
    <PageShell
      title="Export"
      description={DESCRIPTION[tab]}
      action={
        tab === 'lembar' ? (
          <button type="button" className={primaryBtn} disabled={!unduhEnabled} onClick={onUnduh}>
            Unduh
          </button>
        ) : undefined
      }
    >
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

              {selectedIds.length > 0 ? (
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-700">
                  <span role="status">{selectedIds.length} terpilih</span>
                  <button type="button" className={actionBtn} onClick={() => setSelectedIds([])}>
                    Hapus pilihan
                  </button>
                </div>
              ) : null}

              <label className="block max-w-md text-sm">
                <span className="text-slate-700">Program Studi</span>
                <select
                  className="mt-1 w-full rounded border border-slate-300 pl-3 pr-9 py-1.5 text-sm"
                  aria-label="Program Studi"
                  value={programStudiId ?? ''}
                  onChange={(event) => {
                    const value = event.target.value
                    setProgramStudiId(value === '' ? null : Number(value))
                    setSelectedIds([])
                  }}
                >
                  <option value="">Pilih Program Studi</option>
                  {prodi.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.kode} — {row.nama}
                    </option>
                  ))}
                </select>
              </label>

              {programStudiId == null ? null : jadwal.length === 0 ? (
                <p className="text-slate-600">Belum ada Jadwal</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="w-px px-2 py-2 font-medium">
                          <span className="sr-only">Pilih</span>
                        </th>
                        <th className="px-2 py-2 font-medium">Tahun Akademik</th>
                        <th className="px-2 py-2 font-medium">Semester</th>
                        <th className="px-2 py-2 font-medium">Jenis Kelas</th>
                        <th className="px-2 py-2 font-medium">Kurikulum</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jadwal.map((row) => {
                        const selected = selectedSet.has(row.id)
                        const checkboxId = `export-jadwal-${row.id}`
                        return (
                          <tr
                            key={row.id}
                            className={[
                              'border-b border-slate-100',
                              selected ? 'bg-slate-50' : ''
                            ].join(' ')}
                          >
                            <td className="w-px px-2 py-2">
                              <input
                                id={checkboxId}
                                type="checkbox"
                                className="size-4 rounded border-slate-300"
                                checked={selected}
                                aria-label={`Pilih Jadwal ${row.tahunAkademik} ${row.semester} ${row.jenisKelas}`}
                                onChange={() => toggleSelected(row.id)}
                              />
                            </td>
                            <td className="px-2 py-2 text-slate-800">{row.tahunAkademik}</td>
                            <td className="px-2 py-2 text-slate-800">{row.semester}</td>
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
              )}
            </div>
          )}
        </div>
      </div>
    </PageShell>
  )
}
