import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  dosenSubmitEnabled,
  filterByVisibleText,
  kurikulumSubmitEnabled,
  mataKuliahSubmitEnabled,
  programStudiSubmitEnabled,
  groupKurikulumMappings,
  kurikulumMkTotals,
  mappingSubmitEnabled,
  sortKurikulumMappings,
  unmappedMataKuliah
} from './catalog.ts'

const prodi = [
  { kode: 'IF', nama: 'Informatika' },
  { kode: 'SI', nama: 'Sistem Informasi' }
]

test('empty filter keeps every row', () => {
  const fields = (row: (typeof prodi)[number]) => [row.kode, row.nama]
  assert.deepEqual(filterByVisibleText(prodi, '', fields), prodi)
  assert.deepEqual(filterByVisibleText(prodi, '   ', fields), prodi)
})

test('filter matches visible fields case-insensitively', () => {
  const fields = (row: (typeof prodi)[number]) => [row.kode, row.nama]
  assert.deepEqual(filterByVisibleText(prodi, 'sistem', fields), [
    { kode: 'SI', nama: 'Sistem Informasi' }
  ])
  assert.deepEqual(filterByVisibleText(prodi, 'if', fields), [{ kode: 'IF', nama: 'Informatika' }])
})

test('filter skips null visible fields', () => {
  const dosen = [{ nama: 'Ada', nidn: null, nuptk: '123' }]
  assert.deepEqual(
    filterByVisibleText(dosen, '123', (row) => [row.nama, row.nidn, row.nuptk]),
    dosen
  )
})

test('Program Studi submit stays disabled until kode and nama are filled', () => {
  assert.equal(programStudiSubmitEnabled({ kode: '', nama: 'Informatika' }), false)
  assert.equal(programStudiSubmitEnabled({ kode: 'IF', nama: '  ' }), false)
  assert.equal(programStudiSubmitEnabled({ kode: 'IF', nama: 'Informatika' }), true)
})

test('Mata Kuliah submit stays disabled until kode, nama, and sks are filled', () => {
  assert.equal(mataKuliahSubmitEnabled({ kode: 'IF101', nama: 'Algoritma', sks: '' }), false)
  assert.equal(mataKuliahSubmitEnabled({ kode: 'IF101', nama: 'Algoritma', sks: '3' }), true)
})

test('Dosen submit stays disabled until nama and NIDN or NUPTK are filled', () => {
  assert.equal(dosenSubmitEnabled({ nama: 'Ada', nidn: '', nuptk: '' }), false)
  assert.equal(dosenSubmitEnabled({ nama: '', nidn: '1', nuptk: '' }), false)
  assert.equal(dosenSubmitEnabled({ nama: 'Ada', nidn: '1', nuptk: '' }), true)
  assert.equal(dosenSubmitEnabled({ nama: 'Ada', nidn: '', nuptk: '2' }), true)
})

test('Kurikulum submit stays disabled until nama is filled', () => {
  assert.equal(kurikulumSubmitEnabled({ nama: '' }), false)
  assert.equal(kurikulumSubmitEnabled({ nama: '  ' }), false)
  assert.equal(kurikulumSubmitEnabled({ nama: 'Kurikulum 2024' }), true)
})

const catalog = [
  { id: 1, kode: 'IF101', nama: 'Algoritma' },
  { id: 2, kode: 'IF102', nama: 'Basis Data' },
  { id: 3, kode: 'IF103', nama: 'Jaringan' }
]

test('unmapped Mata Kuliah keeps the whole catalog when the Kurikulum has no mappings', () => {
  assert.deepEqual(unmappedMataKuliah(catalog, []), catalog)
})

test('unmapped Mata Kuliah without a Semester keeps the whole catalog', () => {
  assert.deepEqual(
    unmappedMataKuliah(catalog, [
      { mataKuliahId: 1, semester: 'Ganjil', semesterKe: 1 },
      { mataKuliahId: 1, semester: 'Genap', semesterKe: 2 }
    ]),
    catalog
  )
})

test('unmapped Mata Kuliah for one Semester ke drops only MK already on that ke', () => {
  const mappings = [
    { mataKuliahId: 1, semester: 'Ganjil' as const, semesterKe: 1 },
    { mataKuliahId: 3, semester: 'Ganjil' as const, semesterKe: null }
  ]
  assert.deepEqual(unmappedMataKuliah(catalog, mappings, 'Ganjil', 1), [
    { id: 2, kode: 'IF102', nama: 'Basis Data' },
    { id: 3, kode: 'IF103', nama: 'Jaringan' }
  ])
  assert.deepEqual(unmappedMataKuliah(catalog, mappings, 'Ganjil', 3), catalog)
  assert.deepEqual(unmappedMataKuliah(catalog, mappings, 'Ganjil', null), [
    { id: 1, kode: 'IF101', nama: 'Algoritma' },
    { id: 2, kode: 'IF102', nama: 'Basis Data' }
  ])
})

test('mapping submit stays disabled until at least one MK and a Semester are chosen', () => {
  assert.equal(mappingSubmitEnabled({ selectedCount: 0, semester: 'Ganjil' }), false)
  assert.equal(mappingSubmitEnabled({ selectedCount: 2, semester: '' }), false)
  assert.equal(mappingSubmitEnabled({ selectedCount: 1, semester: 'Genap' }), true)
})

test('Kurikulum MK totals count Ganjil, Genap, each Semester ke, and unassigned', () => {
  assert.deepEqual(
    kurikulumMkTotals([
      { semester: 'Ganjil', semesterKe: 1, sks: 3 },
      { semester: 'Ganjil', semesterKe: 1, sks: 2 },
      { semester: 'Ganjil', semesterKe: 5, sks: 4 },
      { semester: 'Ganjil', semesterKe: null, sks: 3 },
      { semester: 'Genap', semesterKe: 2, sks: 2 },
      { semester: 'Genap', semesterKe: 8, sks: 3 }
    ]),
    {
      ganjil: { mk: 4, sks: 12 },
      genap: { mk: 2, sks: 5 },
      ke: [
        { mk: 2, sks: 5 },
        { mk: 1, sks: 2 },
        { mk: 0, sks: 0 },
        { mk: 0, sks: 0 },
        { mk: 1, sks: 4 },
        { mk: 0, sks: 0 },
        { mk: 0, sks: 0 },
        { mk: 1, sks: 3 }
      ],
      tanpaKeGanjil: { mk: 1, sks: 3 },
      tanpaKeGenap: { mk: 0, sks: 0 }
    }
  )
})

test('mapped MK group by Semester ke ascending, blanks last', () => {
  const grouped = groupKurikulumMappings([
    { id: 1, semesterKe: 5 },
    { id: 2, semesterKe: null },
    { id: 4, semesterKe: 1 },
    { id: 3, semesterKe: 1 }
  ])
  assert.deepEqual(
    grouped.map((group) => ({ ke: group.semesterKe, ids: group.rows.map((row) => row.id) })),
    [
      { ke: 1, ids: [4, 3] },
      { ke: 5, ids: [1] },
      { ke: null, ids: [2] }
    ]
  )
})

test('mapped MK sort by Semester ke then kode, blanks last', () => {
  const rows = [
    { id: 1, mataKuliahId: 1, semesterKe: 5 },
    { id: 2, mataKuliahId: 2, semesterKe: null },
    { id: 3, mataKuliahId: 3, semesterKe: 1 },
    { id: 4, mataKuliahId: 4, semesterKe: 1 }
  ]
  const kodeOf = (id: number): string =>
    ({ 1: 'IF301', 2: 'IF101', 3: 'IF202', 4: 'IF101' })[id]!
  assert.deepEqual(
    sortKurikulumMappings(rows, kodeOf).map((row) => row.id),
    [4, 3, 1, 2]
  )
})
