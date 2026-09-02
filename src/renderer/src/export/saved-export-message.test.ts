import assert from 'node:assert/strict'
import { test } from 'node:test'
import { savedExportMessage } from './saved-export-message.ts'

test('savedExportMessage prefixes full path', () => {
  assert.equal(savedExportMessage('/home/user/Downloads/jadwal.xlsx'), 'Tersimpan: /home/user/Downloads/jadwal.xlsx')
})
