import assert from 'node:assert/strict'
import { test } from 'node:test'
import { lembarGapStatus, lembarWeekdayGaps, lembarWeekendRows } from './lembar.ts'

const snapshots = [
  { id: 1, jadwalId: 1, kode: 'IF101', nama: 'Algoritma', sks: 3, mataKuliahId: 1, semesterKe: null },
  { id: 2, jadwalId: 1, kode: 'IF102', nama: 'Basis', sks: 2, mataKuliahId: 2, semesterKe: null },
  { id: 3, jadwalId: 1, kode: 'IF103', nama: 'Jaringan', sks: 3, mataKuliahId: 3, semesterKe: null },
  { id: 4, jadwalId: 1, kode: 'IF104', nama: 'Etika', sks: 2, mataKuliahId: 4, semesterKe: null }
]

test('lembarGapStatus distinguishes missing, belum hari, and belum jam', () => {
  assert.equal(lembarGapStatus(undefined), 'missing')
  assert.equal(
    lembarGapStatus({
      id: 1,
      jadwalId: 1,
      snapshotMkId: 1,
      dosenId: null,
      hari: null,
      jamMulai: 480,
      jamSelesai: 630
    }),
    'belum hari'
  )
  assert.equal(
    lembarGapStatus({
      id: 1,
      jadwalId: 1,
      snapshotMkId: 1,
      dosenId: null,
      hari: 2,
      jamMulai: null,
      jamSelesai: null
    }),
    'belum jam'
  )
})

test('lembarWeekdayGaps lists missing and incomplete weekday Kelas only', () => {
  const gaps = lembarWeekdayGaps(snapshots, [
    {
      id: 10,
      jadwalId: 1,
      snapshotMkId: 2,
      dosenId: null,
      hari: 1,
      jamMulai: 480,
      jamSelesai: 630
    },
    {
      id: 11,
      jadwalId: 1,
      snapshotMkId: 3,
      dosenId: null,
      hari: 3,
      jamMulai: null,
      jamSelesai: null
    },
    {
      id: 12,
      jadwalId: 1,
      snapshotMkId: 4,
      dosenId: null,
      hari: 6,
      jamMulai: 480,
      jamSelesai: 580
    }
  ])
  assert.deepEqual(
    gaps.map((row) => [row.kode, row.status]),
    [
      ['IF101', 'missing'],
      ['IF103', 'belum jam']
    ]
  )
})

test('lembarWeekendRows lists Sabtu and Minggu Kelas', () => {
  const rows = lembarWeekendRows(snapshots, [
    {
      id: 12,
      jadwalId: 1,
      snapshotMkId: 4,
      dosenId: null,
      hari: 6,
      jamMulai: 480,
      jamSelesai: 580
    },
    {
      id: 13,
      jadwalId: 1,
      snapshotMkId: 1,
      dosenId: null,
      hari: 7,
      jamMulai: null,
      jamSelesai: null
    },
    {
      id: 14,
      jadwalId: 1,
      snapshotMkId: 2,
      dosenId: null,
      hari: 1,
      jamMulai: 480,
      jamSelesai: 630
    }
  ])
  assert.deepEqual(
    rows.map((row) => [row.kode, row.hari]),
    [
      ['IF104', 6],
      ['IF101', 7]
    ]
  )
})
