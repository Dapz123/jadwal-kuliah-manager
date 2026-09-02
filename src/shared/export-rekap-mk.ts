import type { Semester } from './api.ts'
import { filenamePiece } from './export-grid.ts'
import { semesterKeRoman } from './semester-ke.ts'

export const REKAP_MK_HEADERS = [
  'No',
  'Sms',
  'Nama MK',
  'Sks',
  'Dosen Reguler Pagi',
  'Dosen Reguler Sore'
] as const

export const REKAP_MK_TITLE = 'PENUGASAN DOSEN'
export const REKAP_MK_TOTAL_LABEL = 'Total SKS'
export const REKAP_MK_GRAND_LABEL = 'Total Seluruh SKS'

const EM_DASH = '—'

export type RekapMkPackMk = {
  kode: string
  nama: string
  sks: number
  semesterKe: number | null
  dosenPagi: string
  dosenSore: string
}

export type RekapMkMkRow = {
  no: number
  namaMk: string
  sks: number
  dosenPagi: string
  dosenSore: string
  mergeDosen: boolean
}

export type RekapMkBand = {
  semesterKe: number | null
  smsLabel: string
  rows: RekapMkMkRow[]
  totalSks: number
}

export type RekapMkPacked = {
  bands: RekapMkBand[]
  grandSks: number
}

function semesterKeSortKey(semesterKe: number | null): number {
  return semesterKe ?? 99
}

function smsLabel(semesterKe: number | null): string {
  if (semesterKe == null) {
    return EM_DASH
  }
  const roman = semesterKeRoman(semesterKe)
  return roman === '' ? EM_DASH : roman
}

function normalizeDosen(value: string): string {
  const trimmed = value.trim()
  return trimmed === '' ? EM_DASH : trimmed
}

export function packRekapMk(mkList: readonly RekapMkPackMk[]): RekapMkPacked {
  const bySemesterKe = new Map<number | null, RekapMkPackMk[]>()
  for (const mk of mkList) {
    const list = bySemesterKe.get(mk.semesterKe)
    if (list) {
      list.push(mk)
    } else {
      bySemesterKe.set(mk.semesterKe, [mk])
    }
  }

  const keys = [...bySemesterKe.keys()].sort(
    (a, b) => semesterKeSortKey(a) - semesterKeSortKey(b)
  )

  let no = 1
  let grandSks = 0
  const bands: RekapMkBand[] = []

  for (const semesterKe of keys) {
    const rows = bySemesterKe.get(semesterKe)!.slice().sort((a, b) => a.kode.localeCompare(b.kode))
    const bandRows: RekapMkMkRow[] = []
    let totalSks = 0
    for (const mk of rows) {
      totalSks += mk.sks
      const pagi = normalizeDosen(mk.dosenPagi)
      const sore = normalizeDosen(mk.dosenSore)
      const mergeDosen = pagi !== EM_DASH && pagi === sore
      bandRows.push({
        no: no++,
        namaMk: mk.nama,
        sks: mk.sks,
        dosenPagi: pagi,
        dosenSore: mergeDosen ? '' : sore,
        mergeDosen
      })
    }
    grandSks += totalSks
    bands.push({
      semesterKe,
      smsLabel: smsLabel(semesterKe),
      rows: bandRows,
      totalSks
    })
  }

  return { bands, grandSks }
}

export function rekapMkTahunTitle(tahunAkademik: string, semester: Semester): string {
  return `Tahun Akademik ${tahunAkademik} — ${semester}`
}

export function exportRekapMkFilename(
  tahunAkademik: string,
  semester: Semester,
  prodiKodes: readonly string[]
): string {
  const ta = filenamePiece(tahunAkademik)
  const sem = filenamePiece(semester)
  if (prodiKodes.length === 1) {
    return `Rekap-MK-${filenamePiece(prodiKodes[0]!)}-${ta}-${sem}.xlsx`
  }
  return `Rekap-MK-${ta}-${sem}.xlsx`
}
