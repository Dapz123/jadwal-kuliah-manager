import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  exportRekapMkFilename,
  packRekapMk,
  REKAP_MK_GRAND_LABEL,
  REKAP_MK_TOTAL_LABEL,
  rekapMkTahunTitle,
  type RekapMkPackMk
} from './export-rekap-mk.ts'

function mk(partial: Partial<RekapMkPackMk> & Pick<RekapMkPackMk, 'kode' | 'nama'>): RekapMkPackMk {
  return {
    sks: 3,
    semesterKe: 1,
    dosenPagi: '—',
    dosenSore: '—',
    ...partial
  }
}

test('rekapMkTahunTitle includes TA and semester', () => {
  assert.equal(rekapMkTahunTitle('2026/2027', 'Ganjil'), 'Tahun Akademik 2026/2027 — Ganjil')
})

test('exportRekapMkFilename sanitizes TA and includes kode for one prodi', () => {
  assert.equal(
    exportRekapMkFilename('2026/2027', 'Ganjil', ['IF']),
    'Rekap-MK-IF-2026-2027-Ganjil.xlsx'
  )
  assert.equal(
    exportRekapMkFilename('2026/2027', 'Genap', ['IF', 'SI']),
    'Rekap-MK-2026-2027-Genap.xlsx'
  )
})

test('packRekapMk groups by Semester ke I then VIII then null, global No, totals', () => {
  const packed = packRekapMk([
    mk({ kode: 'B', nama: 'MK B', semesterKe: 3, sks: 2 }),
    mk({ kode: 'A', nama: 'MK A', semesterKe: 1, sks: 3, dosenPagi: 'Dr. Ada' }),
    mk({ kode: 'C', nama: 'MK C', semesterKe: null, sks: 4 })
  ])

  assert.equal(packed.bands.length, 3)
  assert.equal(packed.bands[0]!.semesterKe, 1)
  assert.equal(packed.bands[0]!.smsLabel, 'I')
  assert.deepEqual(
    packed.bands[0]!.rows.map((row) => row.namaMk),
    ['MK A']
  )
  assert.equal(packed.bands[0]!.rows[0]!.no, 1)
  assert.equal(packed.bands[0]!.totalSks, 3)

  assert.equal(packed.bands[1]!.semesterKe, 3)
  assert.equal(packed.bands[1]!.rows[0]!.no, 2)
  assert.equal(packed.bands[1]!.totalSks, 2)

  assert.equal(packed.bands[2]!.semesterKe, null)
  assert.equal(packed.bands[2]!.smsLabel, '—')
  assert.equal(packed.bands[2]!.rows[0]!.no, 3)
  assert.equal(packed.bands[2]!.totalSks, 4)

  assert.equal(packed.grandSks, 9)
})

test('packRekapMk merges dosen when Pagi and Sore match', () => {
  const packed = packRekapMk([
    mk({
      kode: 'IF1',
      nama: 'Algoritma',
      dosenPagi: 'Dr. Budi, M.Kom.',
      dosenSore: 'Dr. Budi, M.Kom.'
    })
  ])
  const row = packed.bands[0]!.rows[0]!
  assert.equal(row.mergeDosen, true)
  assert.equal(row.dosenPagi, 'Dr. Budi, M.Kom.')
  assert.equal(row.dosenSore, '')
})

test('packRekapMk keeps separate dosen columns when different', () => {
  const packed = packRekapMk([
    mk({
      kode: 'IF1',
      nama: 'Algoritma',
      dosenPagi: 'Dr. Budi, M.Kom.',
      dosenSore: 'Dr. Citra, S.Kom.'
    })
  ])
  const row = packed.bands[0]!.rows[0]!
  assert.equal(row.mergeDosen, false)
  assert.equal(row.dosenPagi, 'Dr. Budi, M.Kom.')
  assert.equal(row.dosenSore, 'Dr. Citra, S.Kom.')
})

test('packRekapMk treats blank dosen as em dash and includes SKS in totals', () => {
  const packed = packRekapMk([
    mk({ kode: 'IF1', nama: 'Tanpa Dosen', sks: 2, dosenPagi: '', dosenSore: '' })
  ])
  const row = packed.bands[0]!.rows[0]!
  assert.equal(row.dosenPagi, '—')
  assert.equal(row.dosenSore, '—')
  assert.equal(row.mergeDosen, false)
  assert.equal(packed.bands[0]!.totalSks, 2)
  assert.equal(packed.grandSks, 2)
})

test('packRekapMk empty input yields zero grand total', () => {
  const packed = packRekapMk([])
  assert.deepEqual(packed.bands, [])
  assert.equal(packed.grandSks, 0)
})

test('packRekapMk labels use Total SKS and grand label constants in writer', () => {
  assert.equal(REKAP_MK_TOTAL_LABEL, 'Total SKS')
  assert.equal(REKAP_MK_GRAND_LABEL, 'Total Seluruh SKS')
})
