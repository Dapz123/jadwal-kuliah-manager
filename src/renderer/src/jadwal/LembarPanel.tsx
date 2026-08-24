import { useEffect, useState, type JSX } from 'react'
import type { Bentrok, Dosen, Jadwal, JadwalSnapshot, Kelas, ProgramStudi } from '../../../shared/api'
import { isApiError } from '../../../shared/api-error'
import { gelarExportWarning } from '../../../shared/dosen-nama'
import { packJadwalGrid, WEEKDAY_LABELS, type PackedSlot } from '../../../shared/export-grid'
import { semesterKeRoman } from '../../../shared/semester-ke'
import { Banner, WarningBanner } from '../chrome'
import { formatJam, hariLabel, joinBentrok } from './jadwal'
import { lembarWeekdayGaps, lembarWeekendRows, type LembarSideRow } from './lembar'

const DAY_LABELS = WEEKDAY_LABELS

function errorMessage(error: unknown): string {
  if (isApiError(error)) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Terjadi kesalahan'
}

function gapStatusLabel(status: LembarSideRow['status']): string {
  if (status === 'missing') {
    return 'Belum ada Kelas'
  }
  if (status === 'belum hari') {
    return 'Belum hari'
  }
  if (status === 'belum jam') {
    return 'Belum jam'
  }
  return ''
}

function SlotCell({
  slot,
  bentrok,
  onOpen
}: {
  slot: PackedSlot
  bentrok: boolean
  onOpen: (snapshotMkId: number) => void
}): JSX.Element {
  if (slot.kind === 'vacant') {
    return (
      <td colSpan={2} className="border border-slate-400 bg-slate-500 p-0 align-top">
        <div className="grid h-full min-h-16 grid-rows-3">
          <div className="border-b border-slate-400/40" />
          <div className="border-b border-slate-400/40" />
          <div />
        </div>
      </td>
    )
  }
  return (
    <td colSpan={2} className="border border-slate-400 p-0 align-top">
      <button
        type="button"
        className={[
          'grid w-full min-h-16 grid-rows-3 text-left text-xs hover:bg-amber-50',
          bentrok ? 'ring-2 ring-inset ring-amber-500' : 'bg-white'
        ].join(' ')}
        aria-label={`Buka ${slot.mkNama} di Kelas`}
        title={bentrok ? 'Bentrok' : undefined}
        onClick={() => onOpen(slot.snapshotMkId)}
      >
        <div className="flex items-center justify-between gap-1 border-b border-slate-200 px-1 py-0.5 tabular-nums">
          <span className="flex-1 text-right">{formatJam(slot.jamMulai)}</span>
          <span className="text-slate-400">|</span>
          <span className="flex-1">
            {slot.jamSelesai == null ? '—' : formatJam(slot.jamSelesai)}
          </span>
          {bentrok ? (
            <span className="shrink-0 font-semibold text-amber-700" aria-hidden="true">
              !
            </span>
          ) : null}
        </div>
        <div className="border-b border-slate-200 px-1 py-0.5 font-medium leading-snug text-slate-900">
          {slot.mkNama} ({slot.sks})
        </div>
        <div className="px-1 py-0.5 leading-snug text-slate-700">{slot.dosenNama || '—'}</div>
      </button>
    </td>
  )
}

function SideList({
  title,
  rows,
  mode,
  onOpen
}: {
  title: string
  rows: LembarSideRow[]
  mode: 'weekday' | 'weekend'
  onOpen: (snapshotMkId: number) => void
}): JSX.Element {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-500">Tidak ada</p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded border border-slate-200">
          {rows.map((row) => (
            <li key={`${mode}-${row.snapshotMkId}`}>
              <button
                type="button"
                className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-1 px-3 py-2 text-left text-sm hover:bg-slate-50"
                onClick={() => onOpen(row.snapshotMkId)}
              >
                <span className="font-mono font-medium text-slate-900">{row.kode}</span>
                <span className="min-w-0 flex-1 text-slate-800">{row.nama}</span>
                <span className="tabular-nums text-slate-500">{row.sks} SKS</span>
                <span className="text-xs text-slate-500">
                  {mode === 'weekend' && row.hari != null
                    ? hariLabel(row.hari)
                    : gapStatusLabel(row.status)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function LembarPanel({
  jadwal,
  programStudi,
  onOpenSnapshot
}: {
  jadwal: Jadwal
  programStudi: ProgramStudi | undefined
  onOpenSnapshot: (snapshotMkId: number) => void
}): JSX.Element {
  const [snapshots, setSnapshots] = useState<JadwalSnapshot[] | null>(null)
  const [kelas, setKelas] = useState<Kelas[]>([])
  const [dosen, setDosen] = useState<Dosen[]>([])
  const [bentrok, setBentrok] = useState<Bentrok[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setSnapshots(null)
    void Promise.all([
      window.api.listJadwalSnapshots(jadwal.id),
      window.api.listKelas(jadwal.id),
      window.api.listDosen(),
      window.api.listBentrok(jadwal.id)
    ]).then(
      ([snapshotRows, kelasRows, dosenRows, bentrokRows]) => {
        if (cancelled) {
          return
        }
        setSnapshots(snapshotRows)
        setKelas(kelasRows)
        setDosen(dosenRows)
        setBentrok(bentrokRows)
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
  }, [jadwal.id])

  if (error && snapshots == null) {
    return <Banner message={error} />
  }
  if (snapshots == null) {
    return <p className="text-sm text-slate-600">Memuat…</p>
  }

  const grid = packJadwalGrid({ snapshots, kelas, dosen })
  const gelarWarning = gelarExportWarning(grid.gelarWarnings)
  const joined = joinBentrok(kelas, bentrok)
  const bentrokSnapshots = joined.bySnapshotMkId
  const gaps = lembarWeekdayGaps(snapshots, kelas)
  const weekend = lembarWeekendRows(snapshots, kelas)
  const prodiNama = programStudi?.nama ?? 'Program Studi'
  const title = `JADWAL PERKULIAHAN ${prodiNama}`
  const subtitle = `${jadwal.jenisKelas} SEMESTER ${jadwal.semester} TAHUN AKADEMIK ${jadwal.tahunAkademik}`

  return (
    <div className="space-y-6">
      {error ? <Banner message={error} /> : null}
      {gelarWarning ? <WarningBanner message={gelarWarning} /> : null}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] border-collapse text-center text-sm">
          <thead>
            <tr>
              <th
                colSpan={11}
                className="border border-slate-300 bg-white px-2 py-2 text-base font-bold tracking-tight text-slate-900"
              >
                {title}
              </th>
            </tr>
            <tr>
              <th
                colSpan={11}
                className="border border-slate-300 bg-white px-2 py-2 text-sm font-semibold text-slate-800"
              >
                {subtitle}
              </th>
            </tr>
            <tr className="bg-slate-300">
              <th className="border border-slate-400 px-2 py-2 font-semibold">SEMESTER</th>
              {DAY_LABELS.map((label) => (
                <th key={label} colSpan={2} className="border border-slate-400 px-2 py-2 font-semibold">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.semesterBands.flatMap((band) =>
              Array.from({ length: band.count }, (_, offset) => {
                const index = band.start + offset
                return (
                  <tr key={index}>
                    {offset === 0 ? (
                      <td
                        rowSpan={band.count}
                        className="border border-slate-400 bg-white px-2 align-middle font-medium text-slate-800"
                      >
                        {semesterKeRoman(band.semesterKe) || ''}
                      </td>
                    ) : null}
                    {grid.days.map((day, dayIndex) => {
                      const slot = day[index] ?? { kind: 'vacant' as const }
                      const marked =
                        slot.kind === 'occupied' && bentrokSnapshots.has(slot.snapshotMkId)
                      return (
                        <SlotCell
                          key={`${dayIndex}-${index}`}
                          slot={slot}
                          bentrok={marked}
                          onOpen={onOpenSnapshot}
                        />
                      )
                    })}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <SideList
        title="Belum di lembar (Senin–Jumat)"
        rows={gaps}
        mode="weekday"
        onOpen={onOpenSnapshot}
      />
      <SideList title="Sabtu / Minggu" rows={weekend} mode="weekend" onOpen={onOpenSnapshot} />
    </div>
  )
}
