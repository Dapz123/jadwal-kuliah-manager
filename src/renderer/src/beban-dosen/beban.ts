import type { PenugasanDosen } from '../../../shared/api.ts'
import { filterByVisibleText } from '../master-data/catalog.ts'
import { formatJam, hariLabel } from '../jadwal/jadwal.ts'

export function defaultTahunAkademik(tahunList: readonly string[]): string | null {
  return tahunList[0] ?? null
}

export function filterPenugasanDosen(
  rows: readonly PenugasanDosen[],
  query: string
): PenugasanDosen[] {
  return filterByVisibleText([...rows], query, (row) => [
    row.dosenNama,
    row.dosenNidn,
    row.dosenNuptk,
    row.kode,
    row.nama
  ])
}

export function emptyPenugasanMessage(input: {
  hasTahunOptions: boolean
  tahunAkademik?: string | null
  totalCount?: number
  visibleCount?: number
  filter?: string
}): string | null {
  if (!input.hasTahunOptions) {
    return 'Belum ada Jadwal — tidak ada Tahun Akademik.'
  }
  if (input.tahunAkademik == null || input.tahunAkademik === '') {
    return null
  }
  if ((input.visibleCount ?? 0) > 0) {
    return null
  }
  if ((input.totalCount ?? 0) > 0 && (input.filter ?? '').trim() !== '') {
    return 'Tidak ada penugasan yang cocok dengan filter.'
  }
  return `Belum ada penugasan dosen untuk Tahun Akademik ${input.tahunAkademik}.`
}

export function penugasanHariLabel(hari: number | null): string {
  return hari == null ? '—' : hariLabel(hari)
}

export function formatJamRentang(jamMulai: number | null, jamSelesai: number | null): string {
  if (jamMulai == null || jamSelesai == null) {
    return '—'
  }
  return `${formatJam(jamMulai)}–${formatJam(jamSelesai)}`
}
