import assert from 'node:assert/strict'
import { test } from 'node:test'
import { exportCompletenessBanner } from './completeness.ts'

const lengkap = {
  id: 10,
  snapshotMkId: 1,
  dosenId: 1,
  hari: 1,
  jamMulai: 480
}

test('export completeness waits for bentrok before saying Lengkap', () => {
  assert.equal(exportCompletenessBanner([{ id: 1 }], [lengkap], null), null)
  assert.equal(exportCompletenessBanner([{ id: 1 }], [lengkap], []), 'Lengkap')
})

test('export completeness still shows missing counts while bentrok loads', () => {
  assert.equal(exportCompletenessBanner([{ id: 1 }], [], null), '1 belum ada Kelas')
})

test('export completeness appends weekend Kelas that will not enter the sheet', () => {
  assert.equal(
    exportCompletenessBanner(
      [{ id: 1 }],
      [
        {
          id: 10,
          snapshotMkId: 1,
          dosenId: 1,
          hari: 6,
          jamMulai: 480
        }
      ],
      []
    ),
    'Lengkap, 1 Kelas Sabtu/Minggu tidak masuk lembar'
  )
})

test('export completeness keeps missing counts and weekend together', () => {
  assert.equal(
    exportCompletenessBanner(
      [{ id: 1 }, { id: 2 }],
      [
        {
          id: 10,
          snapshotMkId: 1,
          dosenId: 1,
          hari: 7,
          jamMulai: 480
        }
      ],
      []
    ),
    '1 belum ada Kelas, 1 Kelas Sabtu/Minggu tidak masuk lembar'
  )
})
