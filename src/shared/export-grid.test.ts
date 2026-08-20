import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  compareExportJadwalMeta,
  countWrapLines,
  exportBanner,
  exportFilename,
  exportSheetName,
  exportWorkbookFilename,
  formatJamRentang,
  mkCellLabel,
  packJadwalGrid,
  slotDosenNames,
  slotMkLabels,
  slotRowSemesterKe,
  wrapRowHeightPt,
  type PackedSlot
} from './export-grid.ts'

const vacant = { kind: 'vacant' as const }

test('formatJamRentang is zero-padded HH:MM–HH:MM', () => {
  assert.equal(formatJamRentang(480, 630), '08:00–10:30')
  assert.equal(formatJamRentang(960, 1110), '16:00–18:30')
})

test('empty Jadwal packs one gray slot on every weekday', () => {
  const packed = packJadwalGrid({ snapshots: [], kelas: [], dosen: [] })
  assert.equal(packed.slotCount, 1)
  assert.equal(packed.weekendCount, 0)
  assert.deepEqual(packed.days, [[vacant], [vacant], [vacant], [vacant], [vacant]])
})

test('a Senin Kelas with jam mulai occupies Senin and leaves other weekdays vacant', () => {
  const packed = packJadwalGrid({
    snapshots: [{ id: 1, kode: 'IF101', nama: 'Algoritma', sks: 3 }],
    kelas: [
      {
        snapshotMkId: 1,
        dosenId: 10,
        hari: 1,
        jamMulai: 480,
        jamSelesai: 630
      }
    ],
    dosen: [{ id: 10, nama: 'Ada', gelarDepan: 'Dr.', gelarBelakang: 'M.Kom.' }]
  })
  assert.equal(packed.slotCount, 1)
  assert.deepEqual(packed.days[0], [
    {
      kind: 'occupied',
      snapshotMkId: 1,
      jamMulai: 480,
      jamSelesai: 630,
      mkNama: 'Algoritma',
      sks: 3,
      dosenNama: 'Dr. Ada M.Kom.',
      semesterKe: null
    }
  ])
  assert.deepEqual(packed.days.slice(1), [[vacant], [vacant], [vacant], [vacant]])
})

test('a weekday packs Kelas by jam mulai then snapshot kode, including overlapping times', () => {
  const packed = packJadwalGrid({
    snapshots: [
      { id: 1, kode: 'IF202', nama: 'Jaringan', sks: 2 },
      { id: 2, kode: 'IF101', nama: 'Algoritma', sks: 3 },
      { id: 3, kode: 'IF303', nama: 'Kompilasi', sks: 3 }
    ],
    kelas: [
      {
        snapshotMkId: 3,
        dosenId: null,
        hari: 1,
        jamMulai: 600,
        jamSelesai: 750
      },
      {
        snapshotMkId: 1,
        dosenId: null,
        hari: 1,
        jamMulai: 480,
        jamSelesai: 630
      },
      {
        snapshotMkId: 2,
        dosenId: null,
        hari: 1,
        jamMulai: 480,
        jamSelesai: 630
      }
    ],
    dosen: []
  })
  assert.equal(packed.slotCount, 3)
  assert.deepEqual(
    packed.days[0].map((slot) => (slot.kind === 'occupied' ? slot.mkNama : slot.kind)),
    ['Algoritma', 'Jaringan', 'Kompilasi']
  )
})

test('Sabtu and Minggu Kelas are omitted from the grid and counted', () => {
  const packed = packJadwalGrid({
    snapshots: [
      { id: 1, kode: 'IF101', nama: 'Algoritma', sks: 3 },
      { id: 2, kode: 'IF202', nama: 'Jaringan', sks: 2 },
      { id: 3, kode: 'IF303', nama: 'Kompilasi', sks: 3 }
    ],
    kelas: [
      {
        snapshotMkId: 1,
        dosenId: null,
        hari: 1,
        jamMulai: 480,
        jamSelesai: 630
      },
      {
        snapshotMkId: 2,
        dosenId: null,
        hari: 6,
        jamMulai: 480,
        jamSelesai: 580
      },
      {
        snapshotMkId: 3,
        dosenId: null,
        hari: 7,
        jamMulai: null,
        jamSelesai: null
      }
    ],
    dosen: []
  })
  assert.equal(packed.weekendCount, 2)
  assert.equal(packed.slotCount, 1)
  assert.equal(packed.days[0][0].kind, 'occupied')
})

test('Kelas without jam mulai is not placed', () => {
  const packed = packJadwalGrid({
    snapshots: [{ id: 1, kode: 'IF101', nama: 'Algoritma', sks: 3 }],
    kelas: [
      {
        snapshotMkId: 1,
        dosenId: 10,
        hari: 2,
        jamMulai: null,
        jamSelesai: null
      }
    ],
    dosen: [{ id: 10, nama: 'Ada', gelarDepan: null, gelarBelakang: null }]
  })
  assert.equal(packed.slotCount, 1)
  assert.deepEqual(packed.days[1], [vacant])
})

test('occupied slot carries snapshotMkId for navigation', () => {
  const packed = packJadwalGrid({
    snapshots: [{ id: 42, kode: 'IF101', nama: 'Algoritma', sks: 3 }],
    kelas: [
      {
        snapshotMkId: 42,
        dosenId: null,
        hari: 1,
        jamMulai: 480,
        jamSelesai: 630
      }
    ],
    dosen: []
  })
  assert.equal(packed.days[0][0].kind, 'occupied')
  if (packed.days[0][0].kind === 'occupied') {
    assert.equal(packed.days[0][0].snapshotMkId, 42)
  }
})

test('occupied slot copies Semester ke from the snapshot', () => {
  const packed = packJadwalGrid({
    snapshots: [{ id: 1, kode: 'IF101', nama: 'Algoritma', sks: 3, semesterKe: 3 }],
    kelas: [
      {
        snapshotMkId: 1,
        dosenId: null,
        hari: 1,
        jamMulai: 480,
        jamSelesai: 630
      }
    ],
    dosen: []
  })
  assert.equal(packed.days[0][0].kind, 'occupied')
  if (packed.days[0][0].kind === 'occupied') {
    assert.equal(packed.days[0][0].semesterKe, 3)
  }
  assert.deepEqual(packed.semesterBands, [{ semesterKe: 3, start: 0, count: 1 }])
})

test('pack groups by Semester ke ascending with nulls last and records merge bands', () => {
  const packed = packJadwalGrid({
    snapshots: [
      { id: 1, kode: 'IF501', nama: 'Lanjut', sks: 3, semesterKe: 5 },
      { id: 2, kode: 'IF101', nama: 'Dasar', sks: 3, semesterKe: 1 },
      { id: 3, kode: 'IF102', nama: 'Lain', sks: 2, semesterKe: 1 },
      { id: 4, kode: 'IF999', nama: 'Tanpa', sks: 2, semesterKe: null }
    ],
    kelas: [
      {
        snapshotMkId: 1,
        dosenId: null,
        hari: 1,
        jamMulai: 480,
        jamSelesai: 630
      },
      {
        snapshotMkId: 4,
        dosenId: null,
        hari: 2,
        jamMulai: 480,
        jamSelesai: 580
      },
      {
        snapshotMkId: 3,
        dosenId: null,
        hari: 1,
        jamMulai: 600,
        jamSelesai: 700
      },
      {
        snapshotMkId: 2,
        dosenId: null,
        hari: 2,
        jamMulai: 480,
        jamSelesai: 630
      }
    ],
    dosen: []
  })
  assert.deepEqual(packed.semesterBands, [
    { semesterKe: 1, start: 0, count: 1 },
    { semesterKe: 5, start: 1, count: 1 },
    { semesterKe: null, start: 2, count: 1 }
  ])
  assert.equal(packed.slotCount, 3)
  assert.deepEqual(
    packed.days[0].map((slot) => (slot.kind === 'occupied' ? slot.mkNama : slot.kind)),
    ['Lain', 'Lanjut', 'vacant']
  )
  assert.deepEqual(
    packed.days[1].map((slot) => (slot.kind === 'occupied' ? slot.mkNama : slot.kind)),
    ['Dasar', 'vacant', 'Tanpa']
  )
})

test('slot-row Semester ke is the shared Roman, or blank when weekdays disagree', () => {
  const occupied = (
    semesterKe: number | null
  ): Extract<PackedSlot, { kind: 'occupied' }> => ({
    kind: 'occupied',
    snapshotMkId: 1,
    jamMulai: 480,
    jamSelesai: 630,
    mkNama: 'Algoritma',
    sks: 3,
    dosenNama: '',
    semesterKe
  })
  const vacant = { kind: 'vacant' as const }
  assert.equal(slotRowSemesterKe([[occupied(3)], [vacant], [vacant], [vacant], [vacant]], 0), 3)
  assert.equal(slotRowSemesterKe([[occupied(3)], [occupied(3)], [vacant], [vacant], [vacant]], 0), 3)
  assert.equal(slotRowSemesterKe([[occupied(3)], [occupied(5)], [vacant], [vacant], [vacant]], 0), null)
  assert.equal(slotRowSemesterKe([[occupied(3)], [occupied(null)], [vacant], [vacant], [vacant]], 0), null)
  assert.equal(slotRowSemesterKe([[vacant], [vacant], [vacant], [vacant], [vacant]], 0), null)
})

test('incomplete dosen still occupies a slot with an empty dosen name', () => {
  const packed = packJadwalGrid({
    snapshots: [{ id: 1, kode: 'IF101', nama: 'Algoritma', sks: 3 }],
    kelas: [
      {
        snapshotMkId: 1,
        dosenId: null,
        hari: 3,
        jamMulai: 480,
        jamSelesai: 630
      }
    ],
    dosen: []
  })
  assert.equal(packed.days[2][0].kind, 'occupied')
  if (packed.days[2][0].kind === 'occupied') {
    assert.equal(packed.days[2][0].dosenNama, '')
  }
})

test('shorter weekdays get vacant holes so every day has N slots', () => {
  const packed = packJadwalGrid({
    snapshots: [
      { id: 1, kode: 'IF101', nama: 'Algoritma', sks: 3 },
      { id: 2, kode: 'IF202', nama: 'Jaringan', sks: 2 }
    ],
    kelas: [
      {
        snapshotMkId: 1,
        dosenId: null,
        hari: 1,
        jamMulai: 480,
        jamSelesai: 630
      },
      {
        snapshotMkId: 2,
        dosenId: null,
        hari: 1,
        jamMulai: 630,
        jamSelesai: 730
      }
    ],
    dosen: []
  })
  assert.equal(packed.slotCount, 2)
  assert.equal(packed.days[0].length, 2)
  assert.deepEqual(packed.days[4], [vacant, vacant])
})

test('export sheet name is kode-TA-semester-Pagi|Sore with illegal chars stripped', () => {
  assert.equal(
    exportSheetName({
      kode: 'D3MI',
      tahunAkademik: '2026/2027',
      semester: 'Ganjil',
      jenisKelas: 'Reguler Pagi'
    }),
    'D3MI-2026-2027-Ganjil-Pagi'
  )
  assert.equal(
    exportSheetName({
      kode: 'TI',
      tahunAkademik: '2026/2027',
      semester: 'Genap',
      jenisKelas: 'Reguler Sore'
    }),
    'TI-2026-2027-Genap-Sore'
  )
})

test('export workbook filename stays single-pattern for one Jadwal and collapses multi same Prodi+TA', () => {
  const pagi = {
    kode: 'D3MI',
    tahunAkademik: '2026/2027',
    semester: 'Ganjil',
    jenisKelas: 'Reguler Pagi' as const
  }
  const sore = { ...pagi, jenisKelas: 'Reguler Sore' as const, semester: 'Ganjil' }
  assert.equal(exportWorkbookFilename([pagi]), 'Jadwal-D3MI-2026-2027-Ganjil-Pagi.xlsx')
  assert.equal(exportWorkbookFilename([pagi, sore]), 'Jadwal-D3MI-2026-2027.xlsx')
  assert.equal(
    exportWorkbookFilename([
      pagi,
      { ...pagi, kode: 'TI', tahunAkademik: '2026/2027' }
    ]),
    'Jadwal-multi.xlsx'
  )
  assert.equal(
    exportWorkbookFilename([pagi, { ...pagi, tahunAkademik: '2027/2028' }]),
    'Jadwal-multi.xlsx'
  )
})

test('export Jadwal metas sort by kode, TA, semester, then Pagi before Sore', () => {
  const rows = [
    {
      kode: 'TI',
      tahunAkademik: '2026/2027',
      semester: 'Ganjil',
      jenisKelas: 'Reguler Pagi' as const
    },
    {
      kode: 'D3MI',
      tahunAkademik: '2026/2027',
      semester: 'Ganjil',
      jenisKelas: 'Reguler Sore' as const
    },
    {
      kode: 'D3MI',
      tahunAkademik: '2026/2027',
      semester: 'Ganjil',
      jenisKelas: 'Reguler Pagi' as const
    },
    {
      kode: 'D3MI',
      tahunAkademik: '2025/2026',
      semester: 'Genap',
      jenisKelas: 'Reguler Pagi' as const
    }
  ]
  const sorted = rows.slice().sort(compareExportJadwalMeta)
  assert.deepEqual(
    sorted.map((row) => `${row.kode}|${row.tahunAkademik}|${row.semester}|${row.jenisKelas}`),
    [
      'D3MI|2025/2026|Genap|Reguler Pagi',
      'D3MI|2026/2027|Ganjil|Reguler Pagi',
      'D3MI|2026/2027|Ganjil|Reguler Sore',
      'TI|2026/2027|Ganjil|Reguler Pagi'
    ]
  )
})

test('export filename maps Jenis Kelas to Pagi or Sore and replaces slash in Tahun Akademik', () => {
  assert.equal(
    exportFilename({
      kode: 'D3MI',
      tahunAkademik: '2026/2027',
      semester: 'Ganjil',
      jenisKelas: 'Reguler Pagi'
    }),
    'Jadwal-D3MI-2026-2027-Ganjil-Pagi.xlsx'
  )
  assert.equal(
    exportFilename({
      kode: 'TI',
      tahunAkademik: '2026/2027',
      semester: 'Genap',
      jenisKelas: 'Reguler Sore'
    }),
    'Jadwal-TI-2026-2027-Genap-Sore.xlsx'
  )
})

test('export filename strips Windows-illegal characters from every piece', () => {
  assert.equal(
    exportFilename({
      kode: 'D3:MI*',
      tahunAkademik: '2026/2027',
      semester: 'Ganjil',
      jenisKelas: 'Reguler Pagi'
    }),
    'Jadwal-D3-MI--2026-2027-Ganjil-Pagi.xlsx'
  )
})

test('export banner appends weekend count and leaves Lengkap alone when there is none', () => {
  assert.equal(exportBanner('Lengkap', 0), 'Lengkap')
  assert.equal(
    exportBanner('Lengkap', 2),
    'Lengkap, 2 Kelas Sabtu/Minggu tidak masuk lembar'
  )
  assert.equal(
    exportBanner('3 belum ada Kelas', 1),
    '3 belum ada Kelas, 1 Kelas Sabtu/Minggu tidak masuk lembar'
  )
})

test('wrap row height autofits compact: 15pt one line, +11pt per soft-wrapped line', () => {
  assert.equal(wrapRowHeightPt([]), 15)
  assert.equal(wrapRowHeightPt(['']), 15)
  assert.equal(wrapRowHeightPt(['Ada']), 15)
  assert.equal(wrapRowHeightPt(['x'.repeat(48)]), 15)
  assert.equal(wrapRowHeightPt(['x'.repeat(49)]), 26)
  assert.equal(wrapRowHeightPt(['Dr. Ir. Soekarno Hatta, M.Kom.']), 15)
})

test('countWrapLines packs words like Excel soft wrap', () => {
  assert.equal(countWrapLines('one two three', 7), 2)
  assert.equal(countWrapLines('abcdefghij', 5), 2)
})

test('slotMkLabels / slotDosenNames collect occupied cell text across weekdays', () => {
  assert.equal(mkCellLabel('Algoritma', 3), 'Algoritma (3)')
  const days: PackedSlot[][] = [
    [
      {
        kind: 'occupied',
        snapshotMkId: 1,
        jamMulai: 480,
        jamSelesai: 630,
        mkNama: 'AI',
        sks: 2,
        dosenNama: 'Ada',
        semesterKe: null
      }
    ],
    [vacant],
    [
      {
        kind: 'occupied',
        snapshotMkId: 2,
        jamMulai: 480,
        jamSelesai: 630,
        mkNama: 'Pemrograman Berorientasi Objek',
        sks: 3,
        dosenNama: 'Dr. Ir. Soekarno Hatta, M.Kom.',
        semesterKe: null
      }
    ],
    [vacant],
    [vacant]
  ]
  assert.deepEqual(slotMkLabels(days, 0), [
    'AI (2)',
    'Pemrograman Berorientasi Objek (3)'
  ])
  assert.deepEqual(slotDosenNames(days, 0), ['Ada', 'Dr. Ir. Soekarno Hatta, M.Kom.'])
  assert.deepEqual(slotMkLabels([[vacant], [vacant], [vacant], [vacant], [vacant]], 0), [])
})
