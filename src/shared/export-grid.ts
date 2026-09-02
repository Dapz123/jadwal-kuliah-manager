import { dosenNamaLembar, gelarWarningItem } from './dosen-nama.ts'

export type PackedSlot =
  | { kind: 'vacant' }
  | {
      kind: 'occupied'
      snapshotMkId: number
      jamMulai: number
      jamSelesai: number | null
      mkNama: string
      sks: number
      dosenNama: string
      semesterKe: number | null
    }

export type PackJadwalGridInput = {
  snapshots: Array<{
    id: number
    kode: string
    nama: string
    sks: number
    semesterKe?: number | null
  }>
  kelas: Array<{
    snapshotMkId: number
    dosenId: number | null
    hari: number | null
    jamMulai: number | null
    jamSelesai: number | null
  }>
  dosen: Array<{
    id: number
    nama: string
    gelarDepan: string | null
    gelarBelakang: string | null
  }>
}

export type PackedGrid = {
  slotCount: number
  weekendCount: number
  days: PackedSlot[][]
  /** Contiguous SEMESTER column bands after pack-by-ke (ascending, nulls last). */
  semesterBands: Array<{ semesterKe: number | null; start: number; count: number }>
  /** Dosen whose gelar belakang could not be ranked; names on the sheet stay untrimmed. */
  gelarWarnings: string[]
}

export const WEEKDAY_LABELS = ['SENIN', 'SELASA', 'RABU', 'KAMIS', "JUM'AT"] as const

const VACANT: PackedSlot = { kind: 'vacant' }

export function countWeekendKelas(kelas: Array<{ hari: number | null }>): number {
  let count = 0
  for (const row of kelas) {
    if (row.hari === 6 || row.hari === 7) {
      count += 1
    }
  }
  return count
}

function compareSemesterKe(a: number | null, b: number | null): number {
  if (a == null && b == null) {
    return 0
  }
  if (a == null) {
    return 1
  }
  if (b == null) {
    return -1
  }
  return a - b
}

function packDayColumns(
  placeable: Array<{ hari: number; jamMulai: number; kode: string; slot: PackedSlot }>
): PackedSlot[][] {
  const sorted = placeable
    .slice()
    .sort((a, b) => a.jamMulai - b.jamMulai || a.kode.localeCompare(b.kode))
  const byHari: PackedSlot[][] = [[], [], [], [], []]
  for (const row of sorted) {
    byHari[row.hari - 1].push(row.slot)
  }
  const slotCount = Math.max(1, ...byHari.map((slots) => slots.length))
  return byHari.map((slots) => {
    const padded = slots.slice()
    while (padded.length < slotCount) {
      padded.push(VACANT)
    }
    return padded
  })
}

export function packJadwalGrid(input: PackJadwalGridInput): PackedGrid {
  const snapshotById = new Map(input.snapshots.map((row) => [row.id, row]))
  const dosenById = new Map(input.dosen.map((row) => [row.id, row]))
  const placeable: Array<{
    hari: number
    jamMulai: number
    kode: string
    semesterKe: number | null
    slot: PackedSlot
  }> = []
  const weekendCount = countWeekendKelas(input.kelas)
  const gelarWarnings: string[] = []
  const warnedDosen = new Set<number>()

  for (const kelas of input.kelas) {
    if (kelas.hari === 6 || kelas.hari === 7) {
      continue
    }
    if (kelas.hari == null || kelas.hari < 1 || kelas.hari > 5 || kelas.jamMulai == null) {
      continue
    }
    const snapshot = snapshotById.get(kelas.snapshotMkId)
    if (snapshot == null) {
      continue
    }
    const dosen = kelas.dosenId == null ? undefined : dosenById.get(kelas.dosenId)
    const semesterKe = snapshot.semesterKe ?? null
    let dosenNama = ''
    if (dosen != null) {
      const formatted = dosenNamaLembar(dosen)
      dosenNama = formatted.nama
      if (formatted.unknownGelar.length > 0 && !warnedDosen.has(dosen.id)) {
        warnedDosen.add(dosen.id)
        gelarWarnings.push(gelarWarningItem(dosen.nama, formatted.unknownGelar))
      }
    }
    placeable.push({
      hari: kelas.hari,
      jamMulai: kelas.jamMulai,
      kode: snapshot.kode,
      semesterKe,
      slot: {
        kind: 'occupied',
        snapshotMkId: snapshot.id,
        jamMulai: kelas.jamMulai,
        jamSelesai: kelas.jamSelesai,
        mkNama: snapshot.nama,
        sks: snapshot.sks,
        dosenNama,
        semesterKe
      }
    })
  }

  if (placeable.length === 0) {
    const days = [[VACANT], [VACANT], [VACANT], [VACANT], [VACANT]]
    return {
      slotCount: 1,
      weekendCount,
      days,
      semesterBands: [{ semesterKe: null, start: 0, count: 1 }],
      gelarWarnings
    }
  }

  const keOrder: Array<number | null> = []
  const seen = new Set<number | null>()
  for (const row of placeable) {
    if (!seen.has(row.semesterKe)) {
      seen.add(row.semesterKe)
      keOrder.push(row.semesterKe)
    }
  }
  keOrder.sort(compareSemesterKe)

  const days: PackedSlot[][] = [[], [], [], [], []]
  const semesterBands: Array<{ semesterKe: number | null; start: number; count: number }> = []
  let start = 0
  for (const semesterKe of keOrder) {
    const band = packDayColumns(placeable.filter((row) => row.semesterKe === semesterKe))
    const count = band[0].length
    for (let day = 0; day < 5; day += 1) {
      days[day].push(...band[day])
    }
    semesterBands.push({ semesterKe, start, count })
    start += count
  }

  return { slotCount: start, weekendCount, days, semesterBands, gelarWarnings }
}

export function slotRowSemesterKe(days: PackedSlot[][], index: number): number | null {
  let found: number | null = null
  for (const day of days) {
    const slot = day[index]
    if (slot == null || slot.kind !== 'occupied') {
      continue
    }
    if (slot.semesterKe == null) {
      return null
    }
    if (found == null) {
      found = slot.semesterKe
    } else if (found !== slot.semesterKe) {
      return null
    }
  }
  return found
}

const WINDOWS_ILLEGAL = /[\\/:*?"<>|]/g
const SHEET_ILLEGAL = /[\\/?*[\]]/g

export function filenamePiece(value: string): string {
  return value.replace(WINDOWS_ILLEGAL, '-')
}

function jenisKelasShort(jenisKelas: JenisKelas): string {
  return jenisKelas === 'Reguler Sore' ? 'Sore' : 'Pagi'
}

import type { JenisKelas, Semester } from './api.ts'

export type ExportJadwalMeta = {
  kode: string
  tahunAkademik: string
  semester: Semester
  jenisKelas: JenisKelas
}

export function exportFilename(input: ExportJadwalMeta): string {
  const jenis = jenisKelasShort(input.jenisKelas)
  return `Jadwal-${filenamePiece(input.kode)}-${filenamePiece(input.tahunAkademik)}-${filenamePiece(input.semester)}-${filenamePiece(jenis)}.xlsx`
}

/** Sheet tab: `{kode}-{TA}-{Sem}-{Pagi|Sore}`; Excel forbids \ / ? * [ ] and caps at 31 chars. */
export function exportSheetName(input: ExportJadwalMeta): string {
  const jenis = jenisKelasShort(input.jenisKelas)
  const raw = [input.kode, input.tahunAkademik, input.semester, jenis]
    .map((piece) => piece.replace(SHEET_ILLEGAL, '-').replace(WINDOWS_ILLEGAL, '-'))
    .join('-')
  return raw.slice(0, 31)
}

export function exportWorkbookFilename(items: readonly ExportJadwalMeta[]): string {
  if (items.length === 0) {
    return 'Jadwal-multi.xlsx'
  }
  if (items.length === 1) {
    return exportFilename(items[0])
  }
  const first = items[0]
  const sameProdiTa = items.every(
    (row) => row.kode === first.kode && row.tahunAkademik === first.tahunAkademik
  )
  if (sameProdiTa) {
    return `Jadwal-${filenamePiece(first.kode)}-${filenamePiece(first.tahunAkademik)}.xlsx`
  }
  const sameTaSemester = items.every(
    (row) => row.tahunAkademik === first.tahunAkademik && row.semester === first.semester
  )
  if (sameTaSemester) {
    return `Jadwal-${filenamePiece(first.tahunAkademik)}-${filenamePiece(first.semester)}.xlsx`
  }
  return 'Jadwal-multi.xlsx'
}

export function compareExportJadwalMeta(a: ExportJadwalMeta, b: ExportJadwalMeta): number {
  return (
    a.kode.localeCompare(b.kode) ||
    a.tahunAkademik.localeCompare(b.tahunAkademik) ||
    a.semester.localeCompare(b.semester) ||
    jenisKelasShort(a.jenisKelas).localeCompare(jenisKelasShort(b.jenisKelas))
  )
}

export function exportBanner(kelengkapan: string, weekendCount: number): string {
  if (weekendCount <= 0) {
    return kelengkapan
  }
  return `${kelengkapan}, ${weekendCount} Kelas Sabtu/Minggu tidak masuk lembar`
}

/**
 * ponytail: ExcelJS has no row autofit; Excel also won't autofit *merged* wrap cells.
 * Compact AutoFit sim for Agency FB 10 in a 2× day-half merge — prefer short rows; if clip, lower CHARS.
 * 48 was Calibri; Agency FB is condensed so this over-counts lines (taller rows). If sparse, raise CHARS.
 */
export const DAY_HALF_COL_WIDTH = 20
/** Slightly above 2× width so soft-wrap under-counts lines (shorter rows) vs glyph-dense clip risk. */
export const WRAP_ROW_CHARS_PER_LINE = 48
export const WRAP_ROW_MIN_HEIGHT_PT = 15
/** MK/dosen row height when text wraps or exceeds one line in the merged day cell. */
export const WRAP_ROW_WRAPPED_HEIGHT_PT = 30
/** ponytail: length heuristic — tune against Excel print, not char count alone */
export const WRAP_ROW_LONG_TEXT_CHARS = 45

export function mkCellLabel(mkNama: string, sks: number): string {
  return `${mkNama} (${sks})`
}

/** Zero-padded `HH:MM–HH:MM` from minutes-from-midnight. Caller handles nulls. */
export function formatJamRentang(jamMulai: number, jamSelesai: number): string {
  return `${formatJam(jamMulai)}–${formatJam(jamSelesai)}`
}

function formatJam(menit: number): string {
  const hours = Math.floor(menit / 60)
  const minutes = menit % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

/** Soft word-wrap line count (Excel-like); long tokens hard-break at charsPerLine. */
export function countWrapLines(text: string, charsPerLine: number): number {
  const trimmed = text.trim()
  if (trimmed.length === 0) {
    return 0
  }
  const words = trimmed.split(/\s+/)
  let lines = 1
  let used = 0
  for (const word of words) {
    if (word.length > charsPerLine) {
      if (used > 0) {
        lines += 1
      }
      lines += Math.ceil(word.length / charsPerLine) - 1
      used = word.length % charsPerLine
      continue
    }
    const need = used === 0 ? word.length : used + 1 + word.length
    if (need <= charsPerLine) {
      used = need
    } else {
      lines += 1
      used = word.length
    }
  }
  return lines
}

/** Compact autofit-style height from candidate cell texts across Senin–Jumat. */
export function wrapRowHeightPt(texts: readonly string[]): number {
  let lines = 0
  let maxLen = 0
  for (const text of texts) {
    const trimmed = text.trim()
    lines = Math.max(lines, countWrapLines(trimmed, WRAP_ROW_CHARS_PER_LINE))
    maxLen = Math.max(maxLen, trimmed.length)
  }
  if (lines <= 0 && maxLen === 0) {
    return WRAP_ROW_MIN_HEIGHT_PT
  }
  if (lines >= 2 || maxLen >= WRAP_ROW_LONG_TEXT_CHARS) {
    return WRAP_ROW_WRAPPED_HEIGHT_PT
  }
  return WRAP_ROW_MIN_HEIGHT_PT
}

export function slotMkLabels(days: PackedSlot[][], index: number): string[] {
  const labels: string[] = []
  for (const day of days) {
    const slot = day[index]
    if (slot != null && slot.kind === 'occupied') {
      labels.push(mkCellLabel(slot.mkNama, slot.sks))
    }
  }
  return labels
}

export function slotDosenNames(days: PackedSlot[][], index: number): string[] {
  const names: string[] = []
  for (const day of days) {
    const slot = day[index]
    if (slot != null && slot.kind === 'occupied') {
      names.push(slot.dosenNama)
    }
  }
  return names
}
