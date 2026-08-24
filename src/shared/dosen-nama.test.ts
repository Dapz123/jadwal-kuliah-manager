import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  dosenNamaExport,
  dosenNamaLembar,
  dosenNamaLengkap,
  gelarExportWarning
} from './dosen-nama.ts'

test('dosenNamaLengkap stays space-join for UI', () => {
  assert.equal(
    dosenNamaLengkap({ nama: 'Budi', gelarDepan: 'Dr.', gelarBelakang: 'M.Kom.' }),
    'Dr. Budi M.Kom.'
  )
})

test('dosenNamaExport inserts comma only before gelar belakang', () => {
  assert.equal(
    dosenNamaExport({ nama: 'Budi', gelarDepan: 'Dr.', gelarBelakang: 'M.Kom.' }),
    'Dr. Budi, M.Kom.'
  )
  assert.equal(
    dosenNamaExport({ nama: 'Budi', gelarDepan: null, gelarBelakang: 'M.Kom.' }),
    'Budi, M.Kom.'
  )
  assert.equal(
    dosenNamaExport({ nama: 'Budi', gelarDepan: 'Dr.', gelarBelakang: null }),
    'Dr. Budi'
  )
  assert.equal(
    dosenNamaExport({ nama: 'Budi', gelarDepan: null, gelarBelakang: null }),
    'Budi'
  )
})

test('dosenNamaExport trims pieces; blank gelar belakang skips the comma', () => {
  assert.equal(
    dosenNamaExport({ nama: '  Budi  ', gelarDepan: ' Dr. ', gelarBelakang: '  M.Kom.  ' }),
    'Dr. Budi, M.Kom.'
  )
  assert.equal(
    dosenNamaExport({ nama: 'Budi', gelarDepan: 'Dr.', gelarBelakang: '   ' }),
    'Dr. Budi'
  )
})

test('dosenNamaLembar keeps a single gelar belakang', () => {
  assert.deepEqual(
    dosenNamaLembar({ nama: 'Budi', gelarDepan: 'Dr.', gelarBelakang: 'M.Kom.' }),
    { nama: 'Dr. Budi, M.Kom.', unknownGelar: [] }
  )
})

test('dosenNamaLembar keeps only the highest gelar when there are two', () => {
  assert.deepEqual(
    dosenNamaLembar({ nama: 'Budi', gelarDepan: 'Dr.', gelarBelakang: 'S.Kom., M.Kom.' }),
    { nama: 'Dr. Budi, M.Kom.', unknownGelar: [] }
  )
})

test('dosenNamaLembar keeps the two highest gelar when there are three', () => {
  assert.deepEqual(
    dosenNamaLembar({ nama: 'Budi', gelarDepan: null, gelarBelakang: 'S.T., M.T., Ph.D.' }),
    { nama: 'Budi, M.T., Ph.D.', unknownGelar: [] }
  )
})

test('dosenNamaLembar keeps only the highest gelar when there are four', () => {
  assert.deepEqual(
    dosenNamaLembar({
      nama: 'Budi',
      gelarDepan: 'Prof. Dr.',
      gelarBelakang: 'S.Kom., S.T., M.Kom., Ph.D.'
    }),
    { nama: 'Prof. Dr. Budi, Ph.D.', unknownGelar: [] }
  )
})

test('dosenNamaLembar splits gelar belakang on commas and leaves gelar depan intact', () => {
  assert.deepEqual(
    dosenNamaLembar({ nama: 'Budi', gelarDepan: 'Prof. Dr.', gelarBelakang: 'S.T., M.T.' }),
    { nama: 'Prof. Dr. Budi, M.T.', unknownGelar: [] }
  )
})

test('dosenNamaLembar keeps original gelar when a token cannot be ranked', () => {
  assert.deepEqual(
    dosenNamaLembar({ nama: 'Budi', gelarDepan: 'Dr.', gelarBelakang: 'S.Kom., XYZ, M.Kom.' }),
    { nama: 'Dr. Budi, S.Kom., XYZ, M.Kom.', unknownGelar: ['XYZ'] }
  )
})

test('gelarExportWarning lists dosen whose gelar was not trimmed', () => {
  assert.equal(gelarExportWarning([]), null)
  assert.equal(
    gelarExportWarning(['Budi (XYZ)']),
    'Gelar tidak dikenali (nama tidak dipangkas): Budi (XYZ)'
  )
  assert.equal(
    gelarExportWarning(['Budi (XYZ)', 'Ani (Foo.)']),
    'Gelar tidak dikenali (nama tidak dipangkas): Budi (XYZ); Ani (Foo.)'
  )
})
