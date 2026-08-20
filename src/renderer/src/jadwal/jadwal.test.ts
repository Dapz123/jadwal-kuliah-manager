import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  filterDosen,
  formatJam,
  groupKelasSections,
  hariLabel,
  jadwalDaftarTitle,
  jadwalDeepLinkPath,
  jadwalSubmitEnabled,
  jamMulaiDefault,
  jamMulaiOutsideJenisWindow,
  joinBentrok,
  joinBentrokSemesterKe,
  kelasSaveAction,
  kelengkapan,
  kelengkapanBanner,
  countBentrokJadwal,
  parseJam,
  parseJadwalDeepLink
} from './jadwal.ts'

const filled = {
  kurikulumId: '1',
  tahunAkademik: '2026/2027',
  semester: 'Ganjil',
  jenisKelas: 'Reguler Pagi'
}

test('Jadwal submit stays disabled until Kurikulum, Tahun Akademik, Semester, and Jenis Kelas are filled', () => {
  assert.equal(jadwalSubmitEnabled({ ...filled, kurikulumId: '' }), false)
  assert.equal(jadwalSubmitEnabled({ ...filled, tahunAkademik: '  ' }), false)
  assert.equal(jadwalSubmitEnabled({ ...filled, semester: '' }), false)
  assert.equal(jadwalSubmitEnabled({ ...filled, jenisKelas: '' }), false)
  assert.equal(jadwalSubmitEnabled(filled), true)
})

test('kelengkapan is missing when there is no Kelas', () => {
  assert.equal(kelengkapan(null), 'missing')
})

test('kelengkapan is incomplete when a Kelas is missing at least one of dosen, hari, or jam mulai', () => {
  assert.equal(kelengkapan({ dosenId: 1, hari: null, jamMulai: null }), 'incomplete')
  assert.equal(kelengkapan({ dosenId: null, hari: 1, jamMulai: 480 }), 'incomplete')
  assert.equal(kelengkapan({ dosenId: 1, hari: 1, jamMulai: null }), 'incomplete')
  assert.equal(kelengkapan({ dosenId: null, hari: null, jamMulai: null }), 'incomplete')
})

test('kelengkapan is lengkap when dosen, hari, and jam mulai are all set', () => {
  assert.equal(kelengkapan({ dosenId: 1, hari: 1, jamMulai: 480 }), 'lengkap')
})

test('hari 1 is Senin and hari 7 is Minggu', () => {
  assert.equal(hariLabel(1), 'Senin')
  assert.equal(hariLabel(2), 'Selasa')
  assert.equal(hariLabel(3), 'Rabu')
  assert.equal(hariLabel(4), 'Kamis')
  assert.equal(hariLabel(5), 'Jumat')
  assert.equal(hariLabel(6), 'Sabtu')
  assert.equal(hariLabel(7), 'Minggu')
})

test('minutes from midnight round-trip as HH:MM', () => {
  assert.equal(formatJam(0), '00:00')
  assert.equal(formatJam(90), '01:30')
  assert.equal(formatJam(1439), '23:59')
  assert.equal(parseJam('00:00'), 0)
  assert.equal(parseJam('01:30'), 90)
  assert.equal(parseJam('23:59'), 1439)
  assert.equal(parseJam(''), null)
})

test('jam mulai outside Jenis Kelas window is soft-flagged; null and edges are fine', () => {
  assert.equal(jamMulaiOutsideJenisWindow('Reguler Pagi', null), false)
  assert.equal(jamMulaiOutsideJenisWindow('Reguler Pagi', 8 * 60), false)
  assert.equal(jamMulaiOutsideJenisWindow('Reguler Pagi', 16 * 60), false)
  assert.equal(jamMulaiOutsideJenisWindow('Reguler Pagi', 8 * 60 - 1), true)
  assert.equal(jamMulaiOutsideJenisWindow('Reguler Pagi', 16 * 60 + 1), true)
  assert.equal(jamMulaiOutsideJenisWindow('Reguler Sore', 16 * 60), false)
  assert.equal(jamMulaiOutsideJenisWindow('Reguler Sore', 20 * 60), false)
  assert.equal(jamMulaiOutsideJenisWindow('Reguler Sore', 16 * 60 - 1), true)
  assert.equal(jamMulaiOutsideJenisWindow('Reguler Sore', 20 * 60 + 1), true)
})

test('jam mulai default is 08:00 for Pagi and 16:00 for Sore', () => {
  assert.equal(jamMulaiDefault('Reguler Pagi'), 8 * 60)
  assert.equal(jamMulaiDefault('Reguler Sore'), 16 * 60)
})

test('last field cleared deletes; first filled field creates; otherwise update', () => {
  const empty = { dosenId: null, hari: null, jamMulai: null }
  const partial = { dosenId: 1, hari: null, jamMulai: null }
  assert.equal(kelasSaveAction(false, partial), 'create')
  assert.equal(kelasSaveAction(true, partial), 'update')
  assert.equal(kelasSaveAction(true, empty), 'delete')
  assert.equal(kelasSaveAction(false, empty), null)
})

const dosen = [
  {
    id: 1,
    nama: 'Ada',
    gelarDepan: 'Dr.',
    gelarBelakang: 'M.Kom.',
    nidn: '111',
    nuptk: null
  },
  {
    id: 2,
    nama: 'Budi',
    gelarDepan: null,
    gelarBelakang: null,
    nidn: null,
    nuptk: '222'
  }
]

test('Dosen picker filter matches nama lengkap, NIDN, and NUPTK', () => {
  assert.deepEqual(
    filterDosen(dosen, 'dr. ada').map((row) => row.id),
    [1]
  )
  assert.deepEqual(
    filterDosen(dosen, '111').map((row) => row.id),
    [1]
  )
  assert.deepEqual(
    filterDosen(dosen, '222').map((row) => row.id),
    [2]
  )
  assert.deepEqual(
    filterDosen(dosen, '').map((row) => row.id),
    [1, 2]
  )
})

test('kelengkapan banner omits zero counts and says Lengkap when nothing is left', () => {
  assert.equal(kelengkapanBanner({ missing: 0, incomplete: 0, bentrok: 0 }), 'Lengkap')
  assert.equal(
    kelengkapanBanner({ missing: 3, incomplete: 1, bentrok: 0 }),
    '3 belum ada Kelas, 1 belum lengkap'
  )
  assert.equal(kelengkapanBanner({ missing: 0, incomplete: 2, bentrok: 0 }), '2 belum lengkap')
  assert.equal(
    kelengkapanBanner({ missing: 1, incomplete: 0, bentrok: 2 }),
    '1 belum ada Kelas, 2 bentrok'
  )
})

const siSoreBasisData = {
  otherProgramStudiNama: 'Sistem Informasi',
  otherJenisKelas: 'Reguler Sore' as const,
  otherMkKode: 'SI101',
  otherMkNama: 'Basis Data'
}

test('joinBentrok names the other Prodi, Jenis Kelas, and MK on the colliding snapshot row', () => {
  const joined = joinBentrok([{ id: 10, snapshotMkId: 1 }], [{ kelasId: 10, ...siSoreBasisData }])
  assert.equal(joined.bentrokCount, 1)
  assert.deepEqual(joined.bySnapshotMkId.get(1), [
    'Sistem Informasi · Reguler Sore · SI101 Basis Data'
  ])
})

test('joinBentrok keeps every opponent on one row and counts that row once', () => {
  const joined = joinBentrok(
    [{ id: 10, snapshotMkId: 1 }],
    [
      { kelasId: 10, ...siSoreBasisData },
      {
        kelasId: 10,
        otherProgramStudiNama: 'Informatika',
        otherJenisKelas: 'Reguler Pagi',
        otherMkKode: 'IF202',
        otherMkNama: 'Jaringan'
      }
    ]
  )
  assert.equal(joined.bentrokCount, 1)
  assert.deepEqual(joined.bySnapshotMkId.get(1), [
    'Sistem Informasi · Reguler Sore · SI101 Basis Data',
    'Informatika · Reguler Pagi · IF202 Jaringan'
  ])
})

test('joinBentrok counts each colliding snapshot row once', () => {
  const joined = joinBentrok(
    [
      { id: 10, snapshotMkId: 1 },
      { id: 20, snapshotMkId: 2 }
    ],
    [
      {
        kelasId: 10,
        otherProgramStudiNama: 'Informatika',
        otherJenisKelas: 'Reguler Pagi',
        otherMkKode: 'IF102',
        otherMkNama: 'Algoritma'
      },
      {
        kelasId: 20,
        otherProgramStudiNama: 'Informatika',
        otherJenisKelas: 'Reguler Pagi',
        otherMkKode: 'IF101',
        otherMkNama: 'Dasar Pemrograman'
      }
    ]
  )
  assert.equal(joined.bentrokCount, 2)
})

test('countBentrokJadwal counts distinct other Jadwal ids', () => {
  assert.equal(countBentrokJadwal([]), 0)
  assert.equal(countBentrokJadwal([{ otherJadwalId: 2 }, { otherJadwalId: 2 }]), 1)
  assert.equal(
    countBentrokJadwal([{ otherJadwalId: 1 }, { otherJadwalId: 2 }, { otherJadwalId: 1 }]),
    2
  )
})

test('joinBentrokSemesterKe labels the other MK kode and Roman Semester ke', () => {
  const joined = joinBentrokSemesterKe(
    [{ id: 10, snapshotMkId: 1 }],
    [{ kelasId: 10, otherMkKode: 'IF102', semesterKe: 3 }]
  )
  assert.equal(joined.bentrokCount, 1)
  assert.deepEqual(joined.bySnapshotMkId.get(1), ['IF102 · III'])
})

test('joinBentrokSemesterKe keeps every opponent on one row and counts that row once', () => {
  const joined = joinBentrokSemesterKe(
    [{ id: 10, snapshotMkId: 1 }],
    [
      { kelasId: 10, otherMkKode: 'IF102', semesterKe: 3 },
      { kelasId: 10, otherMkKode: 'IF103', semesterKe: 3 }
    ]
  )
  assert.equal(joined.bentrokCount, 1)
  assert.deepEqual(joined.bySnapshotMkId.get(1), ['IF102 · III', 'IF103 · III'])
})

test('Jadwal Daftar title is kode · tahun akademik semester jenis kelas', () => {
  assert.equal(
    jadwalDaftarTitle({
      kode: 'IF',
      tahunAkademik: '2026/2027',
      semester: 'Ganjil',
      jenisKelas: 'Reguler Pagi'
    }),
    'IF · 2026/2027 Ganjil Reguler Pagi'
  )
})

test('jadwal deep link encodes and parses jadwalId + snapshotMkId', () => {
  assert.equal(
    jadwalDeepLinkPath({ jadwalId: 4, snapshotMkId: 12 }),
    '/jadwal?jadwalId=4&snapshotMkId=12'
  )
  assert.deepEqual(parseJadwalDeepLink(new URLSearchParams('jadwalId=4&snapshotMkId=12')), {
    jadwalId: 4,
    snapshotMkId: 12
  })
  assert.equal(parseJadwalDeepLink(new URLSearchParams('jadwalId=4')), null)
  assert.equal(parseJadwalDeepLink(new URLSearchParams('snapshotMkId=12')), null)
  assert.equal(parseJadwalDeepLink(new URLSearchParams('jadwalId=0&snapshotMkId=1')), null)
})

const kelasRows = [
  { kode: 'IF103', nama: 'Jaringan', semesterKe: 3 },
  { kode: 'IF101', nama: 'Algoritma', semesterKe: 1 },
  { kode: 'IF102', nama: 'Basis Data', semesterKe: 1 },
  { kode: 'IF201', nama: 'Etika', semesterKe: null }
]

test('Kelas sections group by Semester ke then kode, blanks last', () => {
  const sections = groupKelasSections(kelasRows, '')
  assert.deepEqual(
    sections.map((section) => [section.label, section.rows.map((row) => row.kode)]),
    [
      ['I', ['IF101', 'IF102']],
      ['III', ['IF103']],
      ['—', ['IF201']]
    ]
  )
})

test('Kelas grouping omits a Semester ke whose visible count is 0', () => {
  const sections = groupKelasSections(
    kelasRows.filter((row) => row.semesterKe !== 3),
    ''
  )
  assert.deepEqual(
    sections.map((section) => section.label),
    ['I', '—']
  )
})

test('Kelas search matches kode or nama and keeps the row in its Semester ke section', () => {
  const byKode = groupKelasSections(kelasRows, 'IF102')
  assert.deepEqual(
    byKode.map((section) => [section.label, section.rows.map((row) => row.kode)]),
    [['I', ['IF102']]]
  )
  const byNama = groupKelasSections(kelasRows, 'algo')
  assert.deepEqual(
    byNama.map((section) => [section.label, section.rows.map((row) => row.kode)]),
    [['I', ['IF101']]]
  )
})

test('Kelas search with zero matches shows no section headers', () => {
  assert.deepEqual(groupKelasSections(kelasRows, 'zzz'), [])
})
