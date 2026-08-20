import { filterByVisibleText, groupKurikulumMappings } from '../master-data/catalog.ts'
import { semesterKeRoman } from '../../../shared/semester-ke.ts'

function filled(value: string): boolean {
  return value.trim() !== ''
}

export function jadwalSubmitEnabled(input: {
  kurikulumId: string
  tahunAkademik: string
  semester: string
  jenisKelas: string
}): boolean {
  return (
    filled(input.kurikulumId) &&
    filled(input.tahunAkademik) &&
    filled(input.semester) &&
    filled(input.jenisKelas)
  )
}

export type Kelengkapan = 'missing' | 'incomplete' | 'lengkap'

export function kelengkapan(
  kelas: { dosenId: number | null; hari: number | null; jamMulai: number | null } | null
): Kelengkapan {
  if (kelas == null) {
    return 'missing'
  }
  const set = [kelas.dosenId, kelas.hari, kelas.jamMulai].filter((value) => value != null).length
  return set === 3 ? 'lengkap' : 'incomplete'
}

const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'] as const

export function hariLabel(hari: number): string {
  return HARI[hari - 1] ?? ''
}

export function formatJam(menit: number): string {
  const hours = Math.floor(menit / 60)
  const minutes = menit % 60
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function parseJam(value: string): number | null {
  const trimmed = value.trim()
  if (trimmed === '') {
    return null
  }
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(trimmed)
  if (!match) {
    return null
  }
  return Number(match[1]) * 60 + Number(match[2])
}

const JAM_MULAI_PAGI_MIN = 8 * 60
const JAM_MULAI_PAGI_MAX = 16 * 60
const JAM_MULAI_SORE_MIN = 16 * 60
const JAM_MULAI_SORE_MAX = 20 * 60

/** Default jam mulai when staff first fills the time field: Pagi 08:00, Sore 16:00. */
export function jamMulaiDefault(jenisKelas: 'Reguler Pagi' | 'Reguler Sore'): number {
  return jenisKelas === 'Reguler Pagi' ? JAM_MULAI_PAGI_MIN : JAM_MULAI_SORE_MIN
}

/** Soft window for jam mulai by Jenis Kelas. Null jam is never out of window. */
export function jamMulaiOutsideJenisWindow(
  jenisKelas: 'Reguler Pagi' | 'Reguler Sore',
  jamMulai: number | null
): boolean {
  if (jamMulai == null) {
    return false
  }
  if (jenisKelas === 'Reguler Pagi') {
    return jamMulai < JAM_MULAI_PAGI_MIN || jamMulai > JAM_MULAI_PAGI_MAX
  }
  return jamMulai < JAM_MULAI_SORE_MIN || jamMulai > JAM_MULAI_SORE_MAX
}

export function kelasSaveAction(
  exists: boolean,
  fields: { dosenId: number | null; hari: number | null; jamMulai: number | null }
): 'create' | 'update' | 'delete' | null {
  const empty = fields.dosenId == null && fields.hari == null && fields.jamMulai == null
  if (!exists) {
    return empty ? null : 'create'
  }
  return empty ? 'delete' : 'update'
}

export function filterDosen<
  T extends {
    nama: string
    gelarDepan: string | null
    gelarBelakang: string | null
    nidn: string | null
    nuptk: string | null
  }
>(dosen: T[], query: string): T[] {
  const needle = query.trim().toLowerCase()
  if (!needle) {
    return dosen
  }
  return dosen.filter((row) =>
    [
      [row.gelarDepan, row.nama, row.gelarBelakang].filter(Boolean).join(' '),
      row.nidn,
      row.nuptk
    ].some((field) => field != null && String(field).toLowerCase().includes(needle))
  )
}

export function joinBentrok(
  kelas: { id: number; snapshotMkId: number }[],
  entries: Array<{
    kelasId: number
    otherProgramStudiNama: string
    otherJenisKelas: string
    otherMkKode: string
    otherMkNama: string
  }>
): { bentrokCount: number; bySnapshotMkId: Map<number, string[]> } {
  const snapshotByKelasId = new Map(kelas.map((row) => [row.id, row.snapshotMkId]))
  const bySnapshotMkId = new Map<number, string[]>()
  for (const entry of entries) {
    const snapshotMkId = snapshotByKelasId.get(entry.kelasId)
    if (snapshotMkId == null) {
      continue
    }
    const label = `${entry.otherProgramStudiNama} · ${entry.otherJenisKelas} · ${entry.otherMkKode} ${entry.otherMkNama}`
    const marks = bySnapshotMkId.get(snapshotMkId) ?? []
    marks.push(label)
    bySnapshotMkId.set(snapshotMkId, marks)
  }
  return { bentrokCount: bySnapshotMkId.size, bySnapshotMkId }
}

/** Distinct Jadwal documents that collide (dosen bentrok), including this Jadwal if it has internal collisions. */
export function countBentrokJadwal(entries: ReadonlyArray<{ otherJadwalId: number }>): number {
  return new Set(entries.map((entry) => entry.otherJadwalId)).size
}

export function joinBentrokSemesterKe(
  kelas: { id: number; snapshotMkId: number }[],
  entries: Array<{ kelasId: number; otherMkKode: string; semesterKe: number }>
): { bentrokCount: number; bySnapshotMkId: Map<number, string[]> } {
  const snapshotByKelasId = new Map(kelas.map((row) => [row.id, row.snapshotMkId]))
  const bySnapshotMkId = new Map<number, string[]>()
  for (const entry of entries) {
    const snapshotMkId = snapshotByKelasId.get(entry.kelasId)
    if (snapshotMkId == null) {
      continue
    }
    const label = `${entry.otherMkKode} · ${semesterKeRoman(entry.semesterKe)}`
    const marks = bySnapshotMkId.get(snapshotMkId) ?? []
    marks.push(label)
    bySnapshotMkId.set(snapshotMkId, marks)
  }
  return { bentrokCount: bySnapshotMkId.size, bySnapshotMkId }
}

export function kelengkapanBanner(counts: {
  missing: number
  incomplete: number
  bentrok: number
}): string {
  if (counts.missing === 0 && counts.incomplete === 0 && counts.bentrok === 0) {
    return 'Lengkap'
  }
  const parts: string[] = []
  if (counts.missing > 0) {
    parts.push(`${counts.missing} belum ada Kelas`)
  }
  if (counts.incomplete > 0) {
    parts.push(`${counts.incomplete} belum lengkap`)
  }
  if (counts.bentrok > 0) {
    parts.push(`${counts.bentrok} bentrok`)
  }
  return parts.join(', ')
}

export function jadwalDaftarTitle(input: {
  kode: string
  tahunAkademik: string
  semester: string
  jenisKelas: string
}): string {
  return `${input.kode} · ${input.tahunAkademik} ${input.semester} ${input.jenisKelas}`
}

export function sortKelasBySemesterKe<T extends { kode: string; semesterKe: number | null }>(
  rows: T[]
): T[] {
  return rows.slice().sort((a, b) => {
    if (a.semesterKe == null && b.semesterKe == null) {
      return a.kode.localeCompare(b.kode)
    }
    if (a.semesterKe == null) {
      return 1
    }
    if (b.semesterKe == null) {
      return -1
    }
    return a.semesterKe - b.semesterKe || a.kode.localeCompare(b.kode)
  })
}

export function groupKelasSections<T extends { kode: string; nama: string; semesterKe: number | null }>(
  rows: T[],
  query: string
): Array<{ label: string; semesterKe: number | null; rows: T[] }> {
  const visible = sortKelasBySemesterKe(
    filterByVisibleText(rows, query, (row) => [row.kode, row.nama])
  )
  return groupKurikulumMappings(visible).map((group) => ({
    label: semesterKeRoman(group.semesterKe) || '—',
    semesterKe: group.semesterKe,
    rows: group.rows
  }))
}

/** Deep-link from Beban Dosen (and similar) into Jadwal → Kelas. */
export function jadwalDeepLinkPath(input: {
  jadwalId: number
  snapshotMkId: number
}): string {
  const params = new URLSearchParams({
    jadwalId: String(input.jadwalId),
    snapshotMkId: String(input.snapshotMkId)
  })
  return `/jadwal?${params}`
}

export function parseJadwalDeepLink(params: URLSearchParams): {
  jadwalId: number
  snapshotMkId: number
} | null {
  const jadwalId = Number(params.get('jadwalId'))
  const snapshotMkId = Number(params.get('snapshotMkId'))
  if (!Number.isInteger(jadwalId) || jadwalId <= 0) {
    return null
  }
  if (!Number.isInteger(snapshotMkId) || snapshotMkId <= 0) {
    return null
  }
  return { jadwalId, snapshotMkId }
}
