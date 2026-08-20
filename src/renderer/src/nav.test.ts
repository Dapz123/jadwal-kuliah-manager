import assert from 'node:assert/strict'
import { test } from 'node:test'
import { DEFAULT_PATH, isNavGroup, NAV_ITEMS, navGroupOpen, navLeaves } from './nav.ts'

test('sidebar lists Data, Jadwal, Pengaturan groups', () => {
  assert.deepEqual(
    NAV_ITEMS.map((item) => item.label),
    ['Data', 'Jadwal', 'Pengaturan']
  )
  assert.ok(NAV_ITEMS.every(isNavGroup))
})

test('Data nests Mata Kuliah, Dosen, Kurikulum', () => {
  const group = NAV_ITEMS.find((item) => item.label === 'Data')
  assert.ok(group && isNavGroup(group))
  assert.deepEqual(
    group.children.map((item) => item.label),
    ['Mata Kuliah', 'Dosen', 'Kurikulum']
  )
})

test('Jadwal nests Jadwal, Beban Dosen, and Export', () => {
  const group = NAV_ITEMS.find((item) => item.label === 'Jadwal')
  assert.ok(group && isNavGroup(group))
  assert.deepEqual(
    group.children.map((item) => item.label),
    ['Jadwal', 'Beban Dosen', 'Export']
  )
})

test('Pengaturan nests Program Studi and Waktu SKS', () => {
  const group = NAV_ITEMS.find((item) => item.label === 'Pengaturan')
  assert.ok(group && isNavGroup(group))
  assert.deepEqual(
    group.children.map((item) => item.label),
    ['Program Studi', 'Waktu SKS']
  )
})

test('first open lands on Mata Kuliah', () => {
  assert.equal(DEFAULT_PATH, '/mata-kuliah')
})

test('nav leaves include every routable path', () => {
  assert.deepEqual(
    navLeaves().map((item) => item.path),
    [
      '/mata-kuliah',
      '/dosen',
      '/kurikulum',
      '/jadwal',
      '/beban-dosen',
      '/export',
      '/program-studi',
      '/waktu-sks'
    ]
  )
})

test('nav group opens on a child path until the user toggles it', () => {
  const data = ['/mata-kuliah', '/dosen', '/kurikulum']
  const jadwal = ['/jadwal', '/beban-dosen', '/export']
  const pengaturan = ['/program-studi', '/waktu-sks']
  assert.equal(navGroupOpen(undefined, data, '/dosen'), true)
  assert.equal(navGroupOpen(undefined, jadwal, '/export'), true)
  assert.equal(navGroupOpen(undefined, jadwal, '/beban-dosen'), true)
  assert.equal(navGroupOpen(undefined, pengaturan, '/waktu-sks'), true)
  assert.equal(navGroupOpen(undefined, data, '/jadwal'), false)
  assert.equal(navGroupOpen(false, data, '/mata-kuliah'), false)
  assert.equal(navGroupOpen(true, jadwal, '/program-studi'), true)
})
