import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { PenugasanDosen } from '../../../shared/api.ts'
import {
  defaultTahunAkademik,
  emptyPenugasanMessage,
  filterPenugasanDosen,
  formatJamRentang,
  penugasanHariLabel
} from './beban.ts'

const sample: PenugasanDosen = {
  kelasId: 1,
  jadwalId: 10,
  snapshotMkId: 20,
  dosenId: 2,
  dosenNama: 'Dr. Budi M.Kom.',
  dosenNidn: '111',
  dosenNuptk: null,
  kode: 'IF101',
  nama: 'Algoritma',
  programStudiNama: 'Informatika',
  semester: 'Ganjil',
  jenisKelas: 'Reguler Pagi',
  semesterKe: 1,
  hari: 1,
  jamMulai: 480,
  jamSelesai: 630
}

test('defaultTahunAkademik takes the first label (already desc)', () => {
  assert.equal(defaultTahunAkademik([]), null)
  assert.equal(defaultTahunAkademik(['2026/2027', '2025/2026']), '2026/2027')
})

test('filterPenugasanDosen matches dosen identity and MK text', () => {
  const other: PenugasanDosen = {
    ...sample,
    kelasId: 2,
    dosenNama: 'Ani',
    dosenNidn: null,
    dosenNuptk: '999',
    kode: 'SI101',
    nama: 'Basis Data'
  }
  const rows = [sample, other]
  assert.deepEqual(filterPenugasanDosen(rows, ''), rows)
  assert.deepEqual(filterPenugasanDosen(rows, 'budi'), [sample])
  assert.deepEqual(filterPenugasanDosen(rows, '111'), [sample])
  assert.deepEqual(filterPenugasanDosen(rows, '999'), [other])
  assert.deepEqual(filterPenugasanDosen(rows, 'basis'), [other])
  assert.deepEqual(filterPenugasanDosen(rows, 'IF101'), [sample])
})

test('emptyPenugasanMessage covers the three empty states', () => {
  assert.equal(emptyPenugasanMessage({ hasTahunOptions: false }), 'Belum ada Jadwal — tidak ada Tahun Akademik.')
  assert.equal(
    emptyPenugasanMessage({
      hasTahunOptions: true,
      tahunAkademik: '2026/2027',
      totalCount: 0,
      visibleCount: 0,
      filter: ''
    }),
    'Belum ada penugasan dosen untuk Tahun Akademik 2026/2027.'
  )
  assert.equal(
    emptyPenugasanMessage({
      hasTahunOptions: true,
      tahunAkademik: '2026/2027',
      totalCount: 2,
      visibleCount: 0,
      filter: 'xyz'
    }),
    'Tidak ada penugasan yang cocok dengan filter.'
  )
  assert.equal(
    emptyPenugasanMessage({
      hasTahunOptions: true,
      tahunAkademik: '2026/2027',
      totalCount: 0,
      visibleCount: 0,
      filter: 'xyz'
    }),
    'Belum ada penugasan dosen untuk Tahun Akademik 2026/2027.'
  )
  assert.equal(
    emptyPenugasanMessage({
      hasTahunOptions: true,
      tahunAkademik: '2026/2027',
      totalCount: 2,
      visibleCount: 2,
      filter: 'budi'
    }),
    null
  )
})

test('penugasanHariLabel and formatJamRentang use dash for nulls', () => {
  assert.equal(penugasanHariLabel(1), 'Senin')
  assert.equal(penugasanHariLabel(null), '—')
  assert.equal(formatJamRentang(480, 630), '08:00–10:30')
  assert.equal(formatJamRentang(null, null), '—')
  assert.equal(formatJamRentang(480, null), '—')
})
