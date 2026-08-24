import { useEffect, useState, type JSX } from 'react'
import type { Jadwal, Kurikulum, ProgramStudi, Semester } from '../../../shared/api'
import { Banner, primaryBtn } from '../chrome'
import { errorMessage, SuccessBanner } from './helpers'

type JadwalRow = Jadwal & { programStudiNama: string; kurikulumNama: string }

export default function ExportBebanPanel({
  prodi
}: {
  prodi: ProgramStudi[]
}): JSX.Element {
  const [tahunOptions, setTahunOptions] = useState<string[] | null>(null)
  const [tahunAkademik, setTahunAkademik] = useState('')
  const [semester, setSemester] = useState<Semester>('Ganjil')
  const [selectedProdiIds, setSelectedProdiIds] = useState<number[]>([])
  const [jadwalRows, setJadwalRows] = useState<JadwalRow[]>([])
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [loadingJadwal, setLoadingJadwal] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [actionBanner, setActionBanner] = useState<string | null>(null)
  const [actionFailed, setActionFailed] = useState(false)
  const [downloading, setDownloading] = useState(false)

  useEffect(() => {
    void window.api.listTahunAkademik().then(
      (list) => {
        setTahunOptions(list)
        setTahunAkademik((current) => (current && list.includes(current) ? current : (list[0] ?? '')))
        setError(null)
      },
      (cause: unknown) => setError(errorMessage(cause))
    )
  }, [])

  useEffect(() => {
    setSelectedProdiIds([])
    setSelectedIds([])
  }, [tahunAkademik, semester])

  useEffect(() => {
    if (!tahunAkademik || selectedProdiIds.length === 0) {
      setJadwalRows([])
      setLoadingJadwal(false)
      return
    }
    let cancelled = false
    setLoadingJadwal(true)
    void Promise.all(
      selectedProdiIds.map(async (programStudiId) => {
        const [jadwal, kurikulum] = await Promise.all([
          window.api.listJadwal(programStudiId),
          window.api.listKurikulum(programStudiId)
        ])
        const kurikulumNama = new Map(kurikulum.map((row: Kurikulum) => [row.id, row.nama]))
        const programStudiNama = prodi.find((row) => row.id === programStudiId)?.nama ?? ''
        return jadwal
          .filter((row) => row.tahunAkademik === tahunAkademik && row.semester === semester)
          .map((row) => ({
            ...row,
            programStudiNama,
            kurikulumNama: kurikulumNama.get(row.kurikulumId) ?? ''
          }))
      })
    ).then(
      (groups) => {
        if (cancelled) {
          return
        }
        const flat = groups.flat().sort((a, b) => {
          return (
            a.programStudiNama.localeCompare(b.programStudiNama) ||
            a.jenisKelas.localeCompare(b.jenisKelas) ||
            a.id - b.id
          )
        })
        setJadwalRows(flat)
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
  }, [tahunAkademik, semester, selectedProdiIds, prodi])

  const unduhEnabled = selectedIds.length > 0 && !downloading
  const selectedSet = new Set(selectedIds)
  const selectedProdiSet = new Set(selectedProdiIds)

  function toggleProdi(id: number): void {
    setSelectedProdiIds((prev) => {
      if (prev.includes(id)) {
        setSelectedIds((selected) =>
          selected.filter((jadwalId) => {
            const row = jadwalRows.find((item) => item.id === jadwalId)
            return row == null || row.programStudiId !== id
          })
        )
        return prev.filter((rowId) => rowId !== id)
      }
      return [...prev, id]
    })
  }

  function toggleJadwal(id: number): void {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]
    )
  }

  function onUnduh(): void {
    if (selectedIds.length === 0 || downloading || !tahunAkademik) {
      return
    }
    setDownloading(true)
    void window.api
      .exportBebanDosenXlsx({
        tahunAkademik,
        semester,
        jadwalIds: selectedIds
      })
      .then(
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

  if (tahunOptions == null) {
    return error ? <Banner message={error} /> : <p className="text-slate-600">Memuat…</p>
  }

  if (tahunOptions.length === 0) {
    return <p className="text-slate-600">Belum ada Jadwal — tidak ada Tahun Akademik.</p>
  }

  if (prodi.length === 0) {
    return <p className="text-slate-600">Buat Program Studi dulu.</p>
  }

  return (
    <div className="space-y-4">
      {error ? <Banner message={error} /> : null}
      {actionBanner ? (
        actionFailed ? (
          <Banner message={actionBanner} />
        ) : (
          <SuccessBanner message={actionBanner} onDismiss={() => setActionBanner(null)} />
        )
      ) : null}

      <div className="flex flex-wrap items-end gap-4">
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
        <div
          className="flex min-w-48 flex-1 flex-col gap-1 text-sm text-slate-700"
          role="group"
          aria-labelledby="export-beban-prodi-label"
        >
          <span id="export-beban-prodi-label">Program Studi</span>
          <div className="min-w-0 overflow-x-auto">
            <div className="flex flex-nowrap gap-3 py-2">
              {prodi.map((row) => {
                const checkboxId = `export-beban-prodi-${row.id}`
                return (
                  <label
                    key={row.id}
                    htmlFor={checkboxId}
                    className="flex shrink-0 items-center gap-2 whitespace-nowrap"
                  >
                    <input
                      id={checkboxId}
                      type="checkbox"
                      className="size-4 rounded border-slate-300"
                      checked={selectedProdiSet.has(row.id)}
                      onChange={() => toggleProdi(row.id)}
                    />
                    <span>
                      {row.kode} — {row.nama}
                    </span>
                  </label>
                )
              })}
            </div>
          </div>
        </div>
        <button
          type="button"
          className={`${primaryBtn} ml-auto shrink-0`}
          disabled={!unduhEnabled}
          onClick={onUnduh}
        >
          Unduh
        </button>
      </div>

      {selectedProdiIds.length === 0 ? null : loadingJadwal ? (
        <p className="text-slate-600">Memuat…</p>
      ) : jadwalRows.length === 0 ? (
        <p className="text-slate-600">Belum ada Jadwal untuk filter ini.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="w-px px-2 py-2 font-medium">
                  <span className="sr-only">Pilih</span>
                </th>
                <th className="px-2 py-2 font-medium">Program Studi</th>
                <th className="px-2 py-2 font-medium">Jenis Kelas</th>
                <th className="px-2 py-2 font-medium">Kurikulum</th>
              </tr>
            </thead>
            <tbody>
              {jadwalRows.map((row) => {
                const selected = selectedSet.has(row.id)
                const checkboxId = `export-beban-jadwal-${row.id}`
                return (
                  <tr
                    key={row.id}
                    className={['border-b border-slate-100', selected ? 'bg-slate-50' : ''].join(
                      ' '
                    )}
                  >
                    <td className="w-px px-2 py-2">
                      <input
                        id={checkboxId}
                        type="checkbox"
                        className="size-4 rounded border-slate-300"
                        checked={selected}
                        aria-label={`Pilih Jadwal ${row.programStudiNama} ${row.jenisKelas}`}
                        onChange={() => toggleJadwal(row.id)}
                      />
                    </td>
                    <td className="px-2 py-2 text-slate-800">{row.programStudiNama}</td>
                    <td className="px-2 py-2 text-slate-800">{row.jenisKelas}</td>
                    <td className="px-2 py-2 text-slate-800">{row.kurikulumNama}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
