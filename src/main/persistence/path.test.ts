import assert from 'node:assert/strict'
import { join } from 'node:path'
import { test } from 'node:test'
import { resolveDatabasePath } from './path.ts'

test('dev path is repo-local .data/jadwal.db when PORTABLE_EXECUTABLE_DIR is unset', () => {
  const projectRoot = '/home/dev/jadwal-kuliah-manager'
  assert.equal(
    resolveDatabasePath({ projectRoot }),
    join(projectRoot, '.data', 'jadwal.db')
  )
})

test('packaged portable path uses PORTABLE_EXECUTABLE_DIR/data/jadwal.db', () => {
  const portableExecutableDir = '/media/usb/JadwalKuliah'
  assert.equal(
    resolveDatabasePath({
      portableExecutableDir,
      projectRoot: '/unused'
    }),
    join(portableExecutableDir, 'data', 'jadwal.db')
  )
})
