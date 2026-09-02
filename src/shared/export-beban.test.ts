import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  BEBAN_GRAND_LABEL,
  bebanProdiTitle,
  bebanTahunTitle,
  exportBebanFilename,
  kelasLabel,
  packBebanDosen,
  type BebanPackKelas
} from './export-beban.ts'

function kelas(
  partial: Partial<BebanPackKelas> & Pick<BebanPackKelas, 'dosen' | 'kode' | 'nama'>
): BebanPackKelas {
  return {
    sks: 3,
    programStudiKode: 'IF',
    semesterKe: 1,
    jenisKelas: 'Reguler Pagi',
    hari: 1,
    jamMulai: 480,
    jamSelesai: 630,
    ...partial
  }
}

test('kelasLabel joins kode, Semester ke Roman, and REG-PAGI/REG-SORE', () => {
  assert.equal(
    kelasLabel({ programStudiKode: 'IF', semesterKe: 3, jenisKelas: 'Reguler Pagi' }),
    'IF III REG-PAGI'
  )
  assert.equal(
    kelasLabel({ programStudiKode: 'SI', semesterKe: null, jenisKelas: 'Reguler Sore' }),
    'SI REG-SORE'
  )
})

test('bebanProdiTitle sorts by kode, joins names, falls back empty nama to kode', () => {
  assert.equal(
    bebanProdiTitle([
      { kode: 'TI', nama: 'Teknik Informatika' },
      { kode: 'MI', nama: 'Manajemen Informatika' },
      { kode: 'TI', nama: 'ignored duplicate' }
    ]),
    'Manajemen Informatika - Teknik Informatika'
  )
  assert.equal(bebanProdiTitle([{ kode: 'SI', nama: '  ' }]), 'SI')
})

test('bebanTahunTitle includes TA and semester with em dash', () => {
  assert.equal(bebanTahunTitle('2026/2027', 'Ganjil'), 'Tahun Akademik 2026/2027 — Ganjil')
})

test('packBebanDosen emits MK rows, Total, spacer, then grand total', () => {
  const rows = packBebanDosen([
    kelas({
      dosen: { id: 1, nama: 'Budi', gelarDepan: 'Dr.', gelarBelakang: 'M.Kom.' },
      kode: 'IF101',
      nama: 'Algoritma',
      sks: 3,
      programStudiKode: 'IF',
      semesterKe: 1,
      hari: 1,
      jamMulai: 480,
      jamSelesai: 630
    }),
    kelas({
      dosen: { id: 1, nama: 'Budi', gelarDepan: 'Dr.', gelarBelakang: 'M.Kom.' },
      kode: 'IF202',
      nama: 'Jaringan',
      sks: 2,
      programStudiKode: 'SI',
      semesterKe: 2,
      jenisKelas: 'Reguler Sore',
      hari: 2,
      jamMulai: 960,
      jamSelesai: 1110
    })
  ])
  assert.deepEqual(rows, [
    {
      kind: 'mk',
      no: 1,
      namaDosen: 'Dr. Budi, M.Kom.',
      mataKuliah: 'Algoritma',
      sks: 3,
      kelas: 'IF I REG-PAGI',
      hari: 'Senin',
      jam: '08:00–10:30'
    },
    {
      kind: 'mk',
      no: '',
      namaDosen: '',
      mataKuliah: 'Jaringan',
      sks: 2,
      kelas: 'SI II REG-SORE',
      hari: 'Selasa',
      jam: '16:00–18:30'
    },
    {
      kind: 'total',
      no: '',
      namaDosen: '',
      mataKuliah: 'Total',
      sks: 5,
      kelas: '',
      hari: '',
      jam: ''
    },
    {
      kind: 'spacer',
      no: '',
      namaDosen: '',
      mataKuliah: '',
      sks: '',
      kelas: '',
      hari: '',
      jam: ''
    },
    {
      kind: 'grand',
      no: '',
      namaDosen: '',
      mataKuliah: BEBAN_GRAND_LABEL,
      sks: 5,
      kelas: '',
      hari: '',
      jam: ''
    }
  ])
})

test('packBebanDosen sorts Kelas by Prodi kode then Jenis then hari then jam then kode', () => {
  const dosen = { id: 1, nama: 'Ada', gelarDepan: null, gelarBelakang: null }
  const rows = packBebanDosen([
    kelas({
      dosen,
      kode: 'ZZ',
      nama: 'Late',
      programStudiKode: 'A',
      jenisKelas: 'Reguler Pagi',
      hari: 1,
      jamMulai: 600
    }),
    kelas({
      dosen,
      kode: 'AA',
      nama: 'Early',
      programStudiKode: 'A',
      jenisKelas: 'Reguler Pagi',
      hari: 1,
      jamMulai: 480
    }),
    kelas({
      dosen,
      kode: 'BB',
      nama: 'Sore',
      programStudiKode: 'A',
      jenisKelas: 'Reguler Sore',
      hari: 1,
      jamMulai: 480
    }),
    kelas({
      dosen,
      kode: 'CC',
      nama: 'Other',
      programStudiKode: 'B',
      jenisKelas: 'Reguler Pagi',
      hari: 1,
      jamMulai: 480
    })
  ])
  assert.deepEqual(
    rows.filter((row) => row.kind === 'mk').map((row) => row.mataKuliah),
    ['Early', 'Late', 'Sore', 'Other']
  )
  assert.equal(rows[4].kind, 'total')
  assert.equal(rows[4].sks, 12)
  assert.equal(rows[5].kind, 'spacer')
  assert.equal(rows[6].kind, 'grand')
  assert.equal(rows[6].sks, 12)
})

test('packBebanDosen puts null hari/jam as em dash and still totals SKS', () => {
  const dosen = { id: 1, nama: 'Ada', gelarDepan: null, gelarBelakang: null }
  const rows = packBebanDosen([
    kelas({
      dosen,
      kode: 'IF2',
      nama: 'Incomplete',
      sks: 2,
      hari: null,
      jamMulai: null,
      jamSelesai: null
    }),
    kelas({
      dosen,
      kode: 'IF1',
      nama: 'Complete',
      sks: 3,
      hari: 3,
      jamMulai: 480,
      jamSelesai: 630
    })
  ])
  assert.equal(rows[0].mataKuliah, 'Complete')
  assert.equal(rows[0].hari, 'Rabu')
  assert.equal(rows[1].mataKuliah, 'Incomplete')
  assert.equal(rows[1].hari, '—')
  assert.equal(rows[1].jam, '—')
  assert.equal(rows[2].mataKuliah, 'Total')
  assert.equal(rows[2].sks, 5)
})

test('packBebanDosen sorts dosen groups, spacers between, grand sums all', () => {
  assert.deepEqual(packBebanDosen([]), [
    {
      kind: 'grand',
      no: '',
      namaDosen: '',
      mataKuliah: BEBAN_GRAND_LABEL,
      sks: 0,
      kelas: '',
      hari: '',
      jam: ''
    }
  ])
  const rows = packBebanDosen([
    kelas({
      dosen: { id: 2, nama: 'Zed', gelarDepan: null, gelarBelakang: null },
      kode: 'Z',
      nama: 'Zed MK',
      sks: 4
    }),
    kelas({
      dosen: { id: 1, nama: 'Ann', gelarDepan: null, gelarBelakang: null },
      kode: 'A',
      nama: 'Ann MK',
      sks: 2
    })
  ])
  assert.deepEqual(
    rows.map((row) => row.kind),
    ['mk', 'total', 'spacer', 'mk', 'total', 'spacer', 'grand']
  )
  assert.deepEqual(
    rows.map((row) => row.mataKuliah),
    ['Ann MK', 'Total', '', 'Zed MK', 'Total', '', BEBAN_GRAND_LABEL]
  )
  assert.equal(rows[0].no, 1)
  assert.equal(rows[0].namaDosen, 'Ann')
  assert.equal(rows[3].no, 2)
  assert.equal(rows[3].namaDosen, 'Zed')
  assert.equal(rows[6].sks, 6)
})

test('exportBebanFilename sanitizes TA slash and includes semester', () => {
  assert.equal(
    exportBebanFilename('2026/2027', 'Ganjil'),
    'Rekap-Penugasan-Dosen-2026-2027-Ganjil.xlsx'
  )
  assert.equal(
    exportBebanFilename('2026/2027', 'Genap'),
    'Rekap-Penugasan-Dosen-2026-2027-Genap.xlsx'
  )
})
