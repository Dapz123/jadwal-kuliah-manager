import { useEffect, useState, type JSX } from 'react'
import { Link } from 'react-router-dom'
import type { PenugasanDosen } from '../../../shared/api'
import { isApiError } from '../../../shared/api-error'
import { semesterKeRoman } from '../../../shared/semester-ke'
import { Banner, PageShell, actionBtn } from '../chrome'
import { jadwalDeepLinkPath } from '../jadwal/jadwal'
import {
  defaultTahunAkademik,
  emptyPenugasanMessage,
  filterPenugasanDosen,
  formatJamRentang,
  penugasanHariLabel
} from './beban'

function dosenIdentitas(row: PenugasanDosen): string {
  return [row.dosenNidn, row.dosenNuptk].filter(Boolean).join(' · ')
}

export default function BebanDosenPage(): JSX.Element {
  const [tahunOptions, setTahunOptions] = useState<string[]>([])
  const [tahunAkademik, setTahunAkademik] = useState<string>('')
  const [rows, setRows] = useState<PenugasanDosen[]>([])
  const [filter, setFilter] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [rowsLoading, setRowsLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void window.api.listTahunAkademik().then(
      (list) => {
        if (cancelled) {
          return
        }
        setTahunOptions(list)
        setTahunAkademik((current) =>
          current && list.includes(current) ? current : (defaultTahunAkademik(list) ?? '')
        )
        setError(null)
        setLoading(false)
      },
      (cause) => {
        if (cancelled) {
          return
        }
        setError(isApiError(cause) ? cause.message : String(cause))
        setLoading(false)
      }
    )
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!tahunAkademik) {
      setRows([])
      setRowsLoading(false)
      return
    }
    let cancelled = false
    setRows([])
    setRowsLoading(true)
    void window.api.listPenugasanDosen(tahunAkademik).then(
      (list) => {
        if (!cancelled) {
          setRows(list)
          setError(null)
          setRowsLoading(false)
        }
      },
      (cause) => {
        if (!cancelled) {
          setError(isApiError(cause) ? cause.message : String(cause))
          setRowsLoading(false)
        }
      }
    )
    return () => {
      cancelled = true
    }
  }, [tahunAkademik])

  const visible = filterPenugasanDosen(rows, filter)
  const emptyMessage =
    loading || rowsLoading
      ? null
      : emptyPenugasanMessage({
          hasTahunOptions: tahunOptions.length > 0,
          tahunAkademik,
          totalCount: rows.length,
          visibleCount: visible.length,
          filter
        })

  return (
    <PageShell
      title="Beban Dosen"
      description="Inventaris penugasan dosen lintas Program Studi untuk satu Tahun Akademik."
    >
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex min-w-48 flex-col gap-1 text-sm text-slate-700">
          Tahun Akademik
          <select
            className="rounded border border-slate-300 pl-3 pr-9 py-2"
            value={tahunAkademik}
            disabled={tahunOptions.length === 0}
            onChange={(event) => setTahunAkademik(event.target.value)}
          >
            {tahunOptions.length === 0 ? <option value="">—</option> : null}
            {tahunOptions.map((tahun) => (
              <option key={tahun} value={tahun}>
                {tahun}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-64 flex-1 flex-col gap-1 text-sm text-slate-700">
          Cari
          <input
            type="search"
            className="rounded border border-slate-300 px-3 py-2"
            placeholder="Dosen, NIDN/NUPTK, kode atau nama MK"
            value={filter}
            disabled={tahunOptions.length === 0}
            onChange={(event) => setFilter(event.target.value)}
          />
        </label>
      </div>

      {error ? (
        <div className="mt-4">
          <Banner message={error} />
        </div>
      ) : null}

      <div className="mt-6 overflow-x-auto">
        {loading || rowsLoading ? (
          <p className="text-sm text-slate-600">Memuat…</p>
        ) : emptyMessage ? (
          <p className="text-sm text-slate-600">{emptyMessage}</p>
        ) : (
          <table className="w-full min-w-[64rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="px-2 py-2 font-medium">Dosen</th>
                <th className="px-2 py-2 font-medium">Kode</th>
                <th className="px-2 py-2 font-medium">Nama</th>
                <th className="px-2 py-2 font-medium">Program Studi</th>
                <th className="px-2 py-2 font-medium">Semester</th>
                <th className="px-2 py-2 font-medium">Jenis Kelas</th>
                <th className="px-2 py-2 font-medium">Semester ke</th>
                <th className="px-2 py-2 font-medium">Hari</th>
                <th className="px-2 py-2 font-medium">Jam</th>
                <th className="w-px whitespace-nowrap px-2 py-2 font-medium">Jadwal</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => {
                const identitas = dosenIdentitas(row)
                return (
                  <tr key={row.kelasId} className="border-b border-slate-100 align-top">
                    <td className="px-2 py-2">
                      <div className="font-medium text-slate-900">{row.dosenNama}</div>
                      {identitas ? (
                        <div className="text-xs text-slate-500">{identitas}</div>
                      ) : null}
                    </td>
                    <td className="px-2 py-2 font-mono text-slate-800">{row.kode}</td>
                    <td className="px-2 py-2 text-slate-800">{row.nama}</td>
                    <td className="px-2 py-2 text-slate-800">{row.programStudiNama}</td>
                    <td className="px-2 py-2 text-slate-800">{row.semester}</td>
                    <td className="px-2 py-2 text-slate-800">{row.jenisKelas}</td>
                    <td className="px-2 py-2 text-slate-800">
                      {semesterKeRoman(row.semesterKe) || '—'}
                    </td>
                    <td className="px-2 py-2 text-slate-800">{penugasanHariLabel(row.hari)}</td>
                    <td className="px-2 py-2 tabular-nums text-slate-800">
                      {formatJamRentang(row.jamMulai, row.jamSelesai)}
                    </td>
                    <td className="w-px whitespace-nowrap px-2 py-2">
                      <Link
                        className={actionBtn}
                        to={jadwalDeepLinkPath({
                          jadwalId: row.jadwalId,
                          snapshotMkId: row.snapshotMkId
                        })}
                      >
                        Buka
                      </Link>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </PageShell>
  )
}
