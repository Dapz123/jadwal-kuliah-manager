import type { JenisKelas, Semester } from './api.ts'
import { dosenNamaLengkap } from './dosen-nama.ts'
import { filenamePiece, formatJamRentang } from './export-grid.ts'
import { semesterKeRoman } from './semester-ke.ts'

const HARI = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'] as const
const EM_DASH = '—'

export const BEBAN_HEADERS = [
  'No',
  'Nama Dosen',
  'Mata Kuliah',
  'SKS',
  'Kelas',
  'Hari',
  'Jam'
] as const

export const BEBAN_TITLE = 'REKAP TUGAS MENGAJAR DOSEN'
export const BEBAN_GRAND_LABEL = 'Total Seluruh SKS'

export type BebanPackKelas = {
  dosen: {
    id: number
    nama: string
    gelarDepan: string | null
    gelarBelakang: string | null
  }
  kode: string
  nama: string
  sks: number
  programStudiKode: string
  semesterKe: number | null
  jenisKelas: JenisKelas
  hari: number | null
  jamMulai: number | null
  jamSelesai: number | null
}

export type BebanDosenPackedRow = {
  no: number | ''
  namaDosen: string
  mataKuliah: string
  sks: number | ''
  kelas: string
  hari: string
  jam: string
  kind: 'mk' | 'total' | 'spacer' | 'grand'
}

function hariText(hari: number | null): string {
  if (hari == null) {
    return EM_DASH
  }
  return HARI[hari - 1] ?? EM_DASH
}

function jamText(jamMulai: number | null, jamSelesai: number | null): string {
  if (jamMulai == null || jamSelesai == null) {
    return EM_DASH
  }
  return formatJamRentang(jamMulai, jamSelesai)
}

function jenisKelasShort(jenisKelas: JenisKelas): string {
  return jenisKelas === 'Reguler Sore' ? 'REG-SORE' : 'REG-PAGI'
}

export function kelasLabel(input: {
  programStudiKode: string
  semesterKe: number | null
  jenisKelas: JenisKelas
}): string {
  return [input.programStudiKode, semesterKeRoman(input.semesterKe), jenisKelasShort(input.jenisKelas)]
    .filter((part) => part !== '')
    .join(' ')
}

/** Unique prodi from selected Jadwal scope: sort by kode, join names with ` - `; empty nama → kode. */
export function bebanProdiTitle(prodi: readonly { kode: string; nama: string }[]): string {
  const byKode = new Map<string, string>()
  for (const row of prodi) {
    if (!byKode.has(row.kode)) {
      byKode.set(row.kode, row.nama.trim() !== '' ? row.nama : row.kode)
    }
  }
  return [...byKode.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, nama]) => nama)
    .join(' - ')
}

export function bebanTahunTitle(tahunAkademik: string, semester: Semester): string {
  return `Tahun Akademik ${tahunAkademik} — ${semester}`
}

function compareKelas(a: BebanPackKelas, b: BebanPackKelas): number {
  return (
    a.programStudiKode.localeCompare(b.programStudiKode) ||
    a.jenisKelas.localeCompare(b.jenisKelas) ||
    (a.hari ?? 99) - (b.hari ?? 99) ||
    (a.jamMulai ?? 1e9) - (b.jamMulai ?? 1e9) ||
    a.kode.localeCompare(b.kode)
  )
}

function emptyRow(
  kind: BebanDosenPackedRow['kind'],
  patch: Partial<BebanDosenPackedRow> = {}
): BebanDosenPackedRow {
  return {
    kind,
    no: '',
    namaDosen: '',
    mataKuliah: '',
    sks: '',
    kelas: '',
    hari: '',
    jam: '',
    ...patch
  }
}

export function packBebanDosen(kelas: readonly BebanPackKelas[]): BebanDosenPackedRow[] {
  const byDosen = new Map<number, BebanPackKelas[]>()
  for (const row of kelas) {
    const list = byDosen.get(row.dosen.id)
    if (list) {
      list.push(row)
    } else {
      byDosen.set(row.dosen.id, [row])
    }
  }

  const groups = [...byDosen.values()].map((list) => list.slice().sort(compareKelas))
  groups.sort((a, b) =>
    dosenNamaLengkap(a[0].dosen).localeCompare(dosenNamaLengkap(b[0].dosen), undefined, {
      sensitivity: 'base'
    })
  )

  const rows: BebanDosenPackedRow[] = []
  let grandSks = 0
  let nomor = 1
  for (const sorted of groups) {
    const totalSks = sorted.reduce((sum, row) => sum + row.sks, 0)
    grandSks += totalSks
    for (let index = 0; index < sorted.length; index += 1) {
      const row = sorted[index]
      rows.push({
        kind: 'mk',
        no: index === 0 ? nomor : '',
        namaDosen: index === 0 ? dosenNamaLengkap(row.dosen) : '',
        mataKuliah: row.nama,
        sks: row.sks,
        kelas: kelasLabel(row),
        hari: hariText(row.hari),
        jam: jamText(row.jamMulai, row.jamSelesai)
      })
    }
    rows.push(
      emptyRow('total', {
        mataKuliah: 'Total',
        sks: totalSks
      })
    )
    rows.push(emptyRow('spacer'))
    nomor += 1
  }

  rows.push(
    emptyRow('grand', {
      mataKuliah: BEBAN_GRAND_LABEL,
      sks: grandSks
    })
  )
  return rows
}

export function exportBebanFilename(tahunAkademik: string, semester: Semester): string {
  return `Beban-Dosen-${filenamePiece(tahunAkademik)}-${filenamePiece(semester)}.xlsx`
}
