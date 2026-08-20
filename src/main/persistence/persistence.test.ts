import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { afterEach, test } from 'node:test'
import { openPersistence, type Persistence } from './persistence.ts'

const dirs: string[] = []

afterEach(() => {
  while (dirs.length > 0) {
    const dir = dirs.pop()
    if (dir) {
      rmSync(dir, { recursive: true, force: true })
    }
  }
})

function tempDbPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'jadwal-db-'))
  dirs.push(dir)
  return join(dir, 'jadwal.db')
}

test('fresh database seeds Waktu SKS to 50 minutes', () => {
  const db = openPersistence(tempDbPath())
  try {
    assert.deepEqual(db.getWaktuSks(), { menit: 50, potonganSoreAktif: true })
  } finally {
    db.close()
  }
})

test('update Waktu SKS then get returns the new minutes', () => {
  const db = openPersistence(tempDbPath())
  try {
    db.updateWaktuSks({ menit: 45, potonganSoreAktif: true })
    assert.deepEqual(db.getWaktuSks(), { menit: 45, potonganSoreAktif: true })
  } finally {
    db.close()
  }
})

test('reopening an existing database keeps updated Waktu SKS', () => {
  const path = tempDbPath()
  const first = openPersistence(path)
  try {
    first.updateWaktuSks({ menit: 40, potonganSoreAktif: true })
  } finally {
    first.close()
  }
  const second = openPersistence(path)
  try {
    assert.deepEqual(second.getWaktuSks(), { menit: 40, potonganSoreAktif: true })
  } finally {
    second.close()
  }
})

test('unwritable database path refuses open with structured error including path', () => {
  const dir = mkdtempSync(join(tmpdir(), 'jadwal-ro-'))
  dirs.push(dir)
  const blocker = join(dir, 'blocker')
  writeFileSync(blocker, '')
  const path = join(blocker, 'nested', 'jadwal.db')

  try {
    openPersistence(path)
    assert.fail('expected openPersistence to throw')
  } catch (error) {
    const err = error as { code?: string; message?: string }
    assert.equal(err.code, 'DB_PATH_UNWRITABLE')
    assert.match(String(err.message), /nested/)
    assert.match(String(err.message), /jadwal\.db/)
  }
})

test('opening a pre-migration database applies migrations then seeds Waktu SKS', () => {
  const path = tempDbPath()
  const blank = new Database(path)
  blank.pragma('user_version = 0')
  blank.close()

  const db = openPersistence(path)
  try {
    assert.deepEqual(db.getWaktuSks(), { menit: 50, potonganSoreAktif: true })
  } finally {
    db.close()
  }
})

test('database at Waktu SKS schema version gains master data tables on open', () => {
  const path = tempDbPath()
  const legacy = new Database(path)
  legacy.exec(`
    CREATE TABLE waktu_sks (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      menit INTEGER NOT NULL CHECK (menit > 0)
    );
    INSERT INTO waktu_sks (id, menit) VALUES (1, 50);
  `)
  legacy.pragma('user_version = 1')
  legacy.close()

  const db = openPersistence(path)
  try {
    assert.deepEqual(db.getWaktuSks(), { menit: 50, potonganSoreAktif: true })
    const created = db.createProgramStudi({ kode: 'IF', nama: 'Informatika' })
    assert.equal(created.kode, 'IF')
    db.createMataKuliah({ kode: 'IF101', nama: 'Algoritma', sks: 3 })
    db.createDosen({ nama: 'Budi', nidn: '111', nuptk: null })
    assert.equal(db.listMataKuliah().length, 1)
    assert.equal(db.listDosen().length, 1)
  } finally {
    db.close()
  }
})

test('open heals waktu_sks when user_version skipped past potongan_sore migration', () => {
  const path = tempDbPath()
  const legacy = new Database(path)
  legacy.exec(`
    CREATE TABLE waktu_sks (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      menit INTEGER NOT NULL CHECK (menit > 0)
    );
    INSERT INTO waktu_sks (id, menit) VALUES (1, 50);
  `)
  legacy.pragma('user_version = 99')
  legacy.close()

  const db = openPersistence(path)
  try {
    assert.deepEqual(db.getWaktuSks(), { menit: 50, potonganSoreAktif: true })
  } finally {
    db.close()
  }
})

test('create Program Studi then list returns it with kode and nama', () => {
  const db = openPersistence(tempDbPath())
  try {
    const created = db.createProgramStudi({ kode: 'IF', nama: 'Informatika' })
    assert.equal(typeof created.id, 'number')
    assert.equal(created.kode, 'IF')
    assert.equal(created.nama, 'Informatika')
    assert.deepEqual(db.listProgramStudi(), [created])
  } finally {
    db.close()
  }
})

test('duplicate Program Studi kode is rejected with structured error', () => {
  const db = openPersistence(tempDbPath())
  try {
    db.createProgramStudi({ kode: 'IF', nama: 'Informatika' })
    try {
      db.createProgramStudi({ kode: 'IF', nama: 'Ilmu Fisika' })
      assert.fail('expected createProgramStudi to throw')
    } catch (error) {
      const err = error as { code?: string; message?: string }
      assert.equal(err.code, 'PROGRAM_STUDI_KODE_DUPLICATE')
      assert.match(String(err.message), /kode/i)
    }
  } finally {
    db.close()
  }
})

test('Program Studi with empty kode or nama is rejected with structured error', () => {
  const db = openPersistence(tempDbPath())
  try {
    try {
      db.createProgramStudi({ kode: '   ', nama: 'Informatika' })
      assert.fail('expected empty kode to throw')
    } catch (error) {
      const err = error as { code?: string; message?: string }
      assert.equal(err.code, 'PROGRAM_STUDI_INVALID')
    }
    try {
      db.createProgramStudi({ kode: 'IF', nama: '  ' })
      assert.fail('expected empty nama to throw')
    } catch (error) {
      const err = error as { code?: string; message?: string }
      assert.equal(err.code, 'PROGRAM_STUDI_INVALID')
    }
    assert.deepEqual(db.listProgramStudi(), [])
  } finally {
    db.close()
  }
})

test('update Program Studi changes kode and nama', () => {
  const db = openPersistence(tempDbPath())
  try {
    const created = db.createProgramStudi({ kode: 'IF', nama: 'Informatika' })
    const updated = db.updateProgramStudi(created.id, { kode: 'SI', nama: 'Sistem Informasi' })
    assert.equal(updated.id, created.id)
    assert.equal(updated.kode, 'SI')
    assert.equal(updated.nama, 'Sistem Informasi')
    assert.deepEqual(db.listProgramStudi(), [updated])
  } finally {
    db.close()
  }
})

test('delete Program Studi removes it from the list', () => {
  const db = openPersistence(tempDbPath())
  try {
    const created = db.createProgramStudi({ kode: 'IF', nama: 'Informatika' })
    db.deleteProgramStudi(created.id)
    assert.deepEqual(db.listProgramStudi(), [])
  } finally {
    db.close()
  }
})

test('Mata Kuliah create, update, and delete round-trip kode nama and sks', () => {
  const db = openPersistence(tempDbPath())
  try {
    const created = db.createMataKuliah({ kode: 'IF101', nama: 'Algoritma', sks: 3 })
    assert.equal(typeof created.id, 'number')
    assert.equal(created.kode, 'IF101')
    assert.equal(created.nama, 'Algoritma')
    assert.equal(created.sks, 3)
    assert.deepEqual(db.listMataKuliah(), [created])

    const updated = db.updateMataKuliah(created.id, {
      kode: 'IF102',
      nama: 'Struktur Data',
      sks: 4
    })
    assert.equal(updated.kode, 'IF102')
    assert.equal(updated.nama, 'Struktur Data')
    assert.equal(updated.sks, 4)
    assert.deepEqual(db.listMataKuliah(), [updated])

    db.deleteMataKuliah(created.id)
    assert.deepEqual(db.listMataKuliah(), [])
  } finally {
    db.close()
  }
})

test('duplicate Mata Kuliah kode is rejected with structured error', () => {
  const db = openPersistence(tempDbPath())
  try {
    db.createMataKuliah({ kode: 'IF101', nama: 'Algoritma', sks: 3 })
    try {
      db.createMataKuliah({ kode: 'IF101', nama: 'Pemrograman', sks: 2 })
      assert.fail('expected createMataKuliah to throw')
    } catch (error) {
      const err = error as { code?: string; message?: string }
      assert.equal(err.code, 'MATA_KULIAH_KODE_DUPLICATE')
      assert.match(String(err.message), /kode/i)
    }
  } finally {
    db.close()
  }
})

test('Mata Kuliah with invalid kode nama or sks is rejected with structured error', () => {
  const db = openPersistence(tempDbPath())
  try {
    try {
      db.createMataKuliah({ kode: 'IF101', nama: 'Algoritma', sks: 0 })
      assert.fail('expected non-positive sks to throw')
    } catch (error) {
      const err = error as { code?: string; message?: string }
      assert.equal(err.code, 'MATA_KULIAH_INVALID')
      assert.match(String(err.message), /sks/i)
    }
    try {
      db.createMataKuliah({ kode: 'IF101', nama: 'Algoritma', sks: -1 })
      assert.fail('expected negative sks to throw')
    } catch (error) {
      const err = error as { code?: string; message?: string }
      assert.equal(err.code, 'MATA_KULIAH_INVALID')
    }
    try {
      db.createMataKuliah({ kode: '  ', nama: 'Algoritma', sks: 3 })
      assert.fail('expected empty kode to throw')
    } catch (error) {
      const err = error as { code?: string; message?: string }
      assert.equal(err.code, 'MATA_KULIAH_INVALID')
    }
    try {
      db.createMataKuliah({ kode: 'IF101', nama: '  ', sks: 3 })
      assert.fail('expected empty nama to throw')
    } catch (error) {
      const err = error as { code?: string; message?: string }
      assert.equal(err.code, 'MATA_KULIAH_INVALID')
    }
    assert.deepEqual(db.listMataKuliah(), [])
  } finally {
    db.close()
  }
})

test('Dosen create, update, and delete round-trip nama gelar and identity numbers', () => {
  const db = openPersistence(tempDbPath())
  try {
    const created = db.createDosen({
      nama: 'Budi Santoso',
      gelarDepan: 'Dr.',
      gelarBelakang: 'M.Kom.',
      nidn: '1234567890',
      nuptk: null
    })
    assert.equal(typeof created.id, 'number')
    assert.equal(created.nama, 'Budi Santoso')
    assert.equal(created.gelarDepan, 'Dr.')
    assert.equal(created.gelarBelakang, 'M.Kom.')
    assert.equal(created.nidn, '1234567890')
    assert.equal(created.nuptk, null)
    assert.deepEqual(db.listDosen(), [created])

    const updated = db.updateDosen(created.id, {
      nama: 'Budi Santoso',
      gelarDepan: null,
      gelarBelakang: 'M.T.',
      nidn: '1234567890',
      nuptk: '998877'
    })
    assert.equal(updated.gelarDepan, null)
    assert.equal(updated.gelarBelakang, 'M.T.')
    assert.equal(updated.nuptk, '998877')
    assert.deepEqual(db.listDosen(), [updated])

    db.deleteDosen(created.id)
    assert.deepEqual(db.listDosen(), [])
  } finally {
    db.close()
  }
})

test('Dosen without NIDN and NUPTK is rejected with structured error', () => {
  const db = openPersistence(tempDbPath())
  try {
    try {
      db.createDosen({ nama: 'Budi Santoso', nidn: null, nuptk: null })
      assert.fail('expected missing identity to throw')
    } catch (error) {
      const err = error as { code?: string; message?: string }
      assert.equal(err.code, 'DOSEN_INVALID')
      assert.match(String(err.message), /NIDN|NUPTK/)
    }
    try {
      db.createDosen({ nama: '  ', nidn: '111', nuptk: null })
      assert.fail('expected empty nama to throw')
    } catch (error) {
      const err = error as { code?: string; message?: string }
      assert.equal(err.code, 'DOSEN_INVALID')
    }
    assert.deepEqual(db.listDosen(), [])
  } finally {
    db.close()
  }
})

test('duplicate Dosen NIDN is rejected while distinct NUPTK-only rows are allowed', () => {
  const db = openPersistence(tempDbPath())
  try {
    db.createDosen({ nama: 'Budi', nidn: '111', nuptk: null })
    try {
      db.createDosen({ nama: 'Ani', nidn: '111', nuptk: '222' })
      assert.fail('expected duplicate NIDN to throw')
    } catch (error) {
      const err = error as { code?: string; message?: string }
      assert.equal(err.code, 'DOSEN_NIDN_DUPLICATE')
    }
    const second = db.createDosen({ nama: 'Cici', nidn: null, nuptk: '333' })
    const third = db.createDosen({ nama: 'Dedi', nidn: null, nuptk: '444' })
    assert.equal(db.listDosen().length, 3)
    assert.equal(second.nidn, null)
    assert.equal(third.nuptk, '444')
  } finally {
    db.close()
  }
})

test('duplicate Dosen NUPTK is rejected with structured error', () => {
  const db = openPersistence(tempDbPath())
  try {
    db.createDosen({ nama: 'Budi', nidn: null, nuptk: '555' })
    try {
      db.createDosen({ nama: 'Ani', nidn: '666', nuptk: '555' })
      assert.fail('expected duplicate NUPTK to throw')
    } catch (error) {
      const err = error as { code?: string; message?: string }
      assert.equal(err.code, 'DOSEN_NUPTK_DUPLICATE')
    }
  } finally {
    db.close()
  }
})

test('create Kurikulum then list by Program Studi returns it', () => {
  const db = openPersistence(tempDbPath())
  try {
    const prodi = db.createProgramStudi({ kode: 'IF', nama: 'Informatika' })
    const created = db.createKurikulum({ programStudiId: prodi.id, nama: 'Kurikulum 2024' })
    assert.equal(typeof created.id, 'number')
    assert.equal(created.programStudiId, prodi.id)
    assert.equal(created.nama, 'Kurikulum 2024')
    assert.deepEqual(db.listKurikulum(prodi.id), [created])
  } finally {
    db.close()
  }
})

test('duplicate Kurikulum nama on the same Program Studi is rejected; same nama on another Prodi is allowed', () => {
  const db = openPersistence(tempDbPath())
  try {
    const ifProdi = db.createProgramStudi({ kode: 'IF', nama: 'Informatika' })
    const siProdi = db.createProgramStudi({ kode: 'SI', nama: 'Sistem Informasi' })
    db.createKurikulum({ programStudiId: ifProdi.id, nama: 'Kurikulum 2024' })
    try {
      db.createKurikulum({ programStudiId: ifProdi.id, nama: 'Kurikulum 2024' })
      assert.fail('expected duplicate nama on same Prodi to throw')
    } catch (error) {
      const err = error as { code?: string; message?: string }
      assert.equal(err.code, 'KURIKULUM_NAMA_DUPLICATE')
    }
    const other = db.createKurikulum({ programStudiId: siProdi.id, nama: 'Kurikulum 2024' })
    assert.equal(other.nama, 'Kurikulum 2024')
    assert.equal(other.programStudiId, siProdi.id)
    assert.equal(db.listKurikulum(ifProdi.id).length, 1)
    assert.equal(db.listKurikulum(siProdi.id).length, 1)
  } finally {
    db.close()
  }
})

test('Kurikulum with empty nama is rejected with structured error', () => {
  const db = openPersistence(tempDbPath())
  try {
    const prodi = db.createProgramStudi({ kode: 'IF', nama: 'Informatika' })
    try {
      db.createKurikulum({ programStudiId: prodi.id, nama: '  ' })
      assert.fail('expected empty nama to throw')
    } catch (error) {
      const err = error as { code?: string; message?: string }
      assert.equal(err.code, 'KURIKULUM_INVALID')
    }
    assert.deepEqual(db.listKurikulum(prodi.id), [])
  } finally {
    db.close()
  }
})

test('update Kurikulum changes nama', () => {
  const db = openPersistence(tempDbPath())
  try {
    const prodi = db.createProgramStudi({ kode: 'IF', nama: 'Informatika' })
    const created = db.createKurikulum({ programStudiId: prodi.id, nama: 'Kurikulum 2024' })
    const updated = db.updateKurikulum(created.id, {
      programStudiId: prodi.id,
      nama: 'Kurikulum 2025'
    })
    assert.equal(updated.id, created.id)
    assert.equal(updated.nama, 'Kurikulum 2025')
    assert.deepEqual(db.listKurikulum(prodi.id), [updated])
  } finally {
    db.close()
  }
})

test('delete Kurikulum removes it from the list', () => {
  const db = openPersistence(tempDbPath())
  try {
    const prodi = db.createProgramStudi({ kode: 'IF', nama: 'Informatika' })
    const created = db.createKurikulum({ programStudiId: prodi.id, nama: 'Kurikulum 2024' })
    db.deleteKurikulum(created.id)
    assert.deepEqual(db.listKurikulum(prodi.id), [])
  } finally {
    db.close()
  }
})

test('add Kurikulum mapping then list returns kurikulum, mata kuliah, and semester', () => {
  const db = openPersistence(tempDbPath())
  try {
    const prodi = db.createProgramStudi({ kode: 'IF', nama: 'Informatika' })
    const kurikulum = db.createKurikulum({ programStudiId: prodi.id, nama: 'Kurikulum 2024' })
    const mk = db.createMataKuliah({ kode: 'IF101', nama: 'Algoritma', sks: 3 })
    const mapping = db.addKurikulumMapping({
      kurikulumId: kurikulum.id,
      mataKuliahId: mk.id,
      semester: 'Ganjil'
    })
    assert.equal(typeof mapping.id, 'number')
    assert.equal(mapping.kurikulumId, kurikulum.id)
    assert.equal(mapping.mataKuliahId, mk.id)
    assert.equal(mapping.semester, 'Ganjil')
    assert.equal(mapping.semesterKe, null)
    assert.deepEqual(db.listKurikulumMappings(kurikulum.id), [mapping])
  } finally {
    db.close()
  }
})

test('duplicate Mata Kuliah on the same Kurikulum is rejected; same MK on another Kurikulum is allowed', () => {
  const db = openPersistence(tempDbPath())
  try {
    const prodi = db.createProgramStudi({ kode: 'IF', nama: 'Informatika' })
    const first = db.createKurikulum({ programStudiId: prodi.id, nama: 'Kurikulum 2024' })
    const second = db.createKurikulum({ programStudiId: prodi.id, nama: 'Kurikulum 2025' })
    const mk = db.createMataKuliah({ kode: 'IF101', nama: 'Algoritma', sks: 3 })
    db.addKurikulumMapping({ kurikulumId: first.id, mataKuliahId: mk.id, semester: 'Ganjil' })
    try {
      db.addKurikulumMapping({ kurikulumId: first.id, mataKuliahId: mk.id, semester: 'Genap' })
      assert.fail('expected duplicate mapping to throw')
    } catch (error) {
      const err = error as { code?: string; message?: string }
      assert.equal(err.code, 'KURIKULUM_MAPPING_DUPLICATE')
    }
    const other = db.addKurikulumMapping({
      kurikulumId: second.id,
      mataKuliahId: mk.id,
      semester: 'Genap'
    })
    assert.equal(other.semester, 'Genap')
    assert.equal(db.listKurikulumMappings(first.id).length, 1)
    assert.equal(db.listKurikulumMappings(second.id).length, 1)
  } finally {
    db.close()
  }
})

test('Kurikulum mapping semester other than Ganjil or Genap is rejected', () => {
  const db = openPersistence(tempDbPath())
  try {
    const prodi = db.createProgramStudi({ kode: 'IF', nama: 'Informatika' })
    const kurikulum = db.createKurikulum({ programStudiId: prodi.id, nama: 'Kurikulum 2024' })
    const mk = db.createMataKuliah({ kode: 'IF101', nama: 'Algoritma', sks: 3 })
    try {
      db.addKurikulumMapping({
        kurikulumId: kurikulum.id,
        mataKuliahId: mk.id,
        semester: 'Pendek' as 'Ganjil'
      })
      assert.fail('expected invalid semester to throw')
    } catch (error) {
      const err = error as { code?: string; message?: string }
      assert.equal(err.code, 'KURIKULUM_MAPPING_INVALID')
      assert.match(String(err.message), /Ganjil|Genap/)
    }
    assert.deepEqual(db.listKurikulumMappings(kurikulum.id), [])
  } finally {
    db.close()
  }
})

test('add Kurikulum mapping stores optional Semester ke when parity matches', () => {
  const db = openPersistence(tempDbPath())
  try {
    const prodi = db.createProgramStudi({ kode: 'IF', nama: 'Informatika' })
    const kurikulum = db.createKurikulum({ programStudiId: prodi.id, nama: 'Kurikulum 2024' })
    const mk = db.createMataKuliah({ kode: 'IF101', nama: 'Algoritma', sks: 3 })
    const mapping = db.addKurikulumMapping({
      kurikulumId: kurikulum.id,
      mataKuliahId: mk.id,
      semester: 'Ganjil',
      semesterKe: 3
    })
    assert.equal(mapping.semesterKe, 3)
    assert.equal(db.listKurikulumMappings(kurikulum.id)[0]?.semesterKe, 3)
  } finally {
    db.close()
  }
})

test('Kurikulum mapping Semester ke that breaks parity is rejected', () => {
  const db = openPersistence(tempDbPath())
  try {
    const prodi = db.createProgramStudi({ kode: 'IF', nama: 'Informatika' })
    const kurikulum = db.createKurikulum({ programStudiId: prodi.id, nama: 'Kurikulum 2024' })
    const mk = db.createMataKuliah({ kode: 'IF101', nama: 'Algoritma', sks: 3 })
    try {
      db.addKurikulumMapping({
        kurikulumId: kurikulum.id,
        mataKuliahId: mk.id,
        semester: 'Ganjil',
        semesterKe: 2
      })
      assert.fail('expected parity mismatch to throw')
    } catch (error) {
      const err = error as { code?: string; message?: string }
      assert.equal(err.code, 'KURIKULUM_MAPPING_INVALID')
    }
    assert.deepEqual(db.listKurikulumMappings(kurikulum.id), [])
  } finally {
    db.close()
  }
})

test('Kurikulum mapping Semester ke outside I–VIII is rejected', () => {
  const db = openPersistence(tempDbPath())
  try {
    const prodi = db.createProgramStudi({ kode: 'IF', nama: 'Informatika' })
    const kurikulum = db.createKurikulum({ programStudiId: prodi.id, nama: 'Kurikulum 2024' })
    const mk = db.createMataKuliah({ kode: 'IF101', nama: 'Algoritma', sks: 3 })
    try {
      db.addKurikulumMapping({
        kurikulumId: kurikulum.id,
        mataKuliahId: mk.id,
        semester: 'Ganjil',
        semesterKe: 9
      })
      assert.fail('expected invalid Semester ke to throw')
    } catch (error) {
      const err = error as { code?: string; message?: string }
      assert.equal(err.code, 'KURIKULUM_MAPPING_INVALID')
    }
  } finally {
    db.close()
  }
})

test('update Kurikulum mapping can set, change, and clear Semester ke', () => {
  const db = openPersistence(tempDbPath())
  try {
    const prodi = db.createProgramStudi({ kode: 'IF', nama: 'Informatika' })
    const kurikulum = db.createKurikulum({ programStudiId: prodi.id, nama: 'Kurikulum 2024' })
    const mk = db.createMataKuliah({ kode: 'IF101', nama: 'Algoritma', sks: 3 })
    const mapping = db.addKurikulumMapping({
      kurikulumId: kurikulum.id,
      mataKuliahId: mk.id,
      semester: 'Ganjil'
    })
    const withKe = db.updateKurikulumMapping(mapping.id, { semester: 'Ganjil', semesterKe: 1 })
    assert.equal(withKe.semesterKe, 1)
    const moved = db.updateKurikulumMapping(mapping.id, { semester: 'Genap', semesterKe: 2 })
    assert.equal(moved.semester, 'Genap')
    assert.equal(moved.semesterKe, 2)
    const cleared = db.updateKurikulumMapping(mapping.id, { semester: 'Genap', semesterKe: null })
    assert.equal(cleared.semester, 'Genap')
    assert.equal(cleared.semesterKe, null)
  } finally {
    db.close()
  }
})

test('update Kurikulum mapping rejects a parity mismatch', () => {
  const db = openPersistence(tempDbPath())
  try {
    const prodi = db.createProgramStudi({ kode: 'IF', nama: 'Informatika' })
    const kurikulum = db.createKurikulum({ programStudiId: prodi.id, nama: 'Kurikulum 2024' })
    const mk = db.createMataKuliah({ kode: 'IF101', nama: 'Algoritma', sks: 3 })
    const mapping = db.addKurikulumMapping({
      kurikulumId: kurikulum.id,
      mataKuliahId: mk.id,
      semester: 'Ganjil',
      semesterKe: 1
    })
    try {
      db.updateKurikulumMapping(mapping.id, { semester: 'Ganjil', semesterKe: 2 })
      assert.fail('expected parity mismatch to throw')
    } catch (error) {
      const err = error as { code?: string; message?: string }
      assert.equal(err.code, 'KURIKULUM_MAPPING_INVALID')
    }
    assert.equal(db.listKurikulumMappings(kurikulum.id)[0]?.semesterKe, 1)
  } finally {
    db.close()
  }
})

test('add many Kurikulum mappings is all-or-nothing', () => {
  const db = openPersistence(tempDbPath())
  try {
    const prodi = db.createProgramStudi({ kode: 'IF', nama: 'Informatika' })
    const kurikulum = db.createKurikulum({ programStudiId: prodi.id, nama: 'Kurikulum 2024' })
    const first = db.createMataKuliah({ kode: 'IF101', nama: 'Algoritma', sks: 3 })
    const second = db.createMataKuliah({ kode: 'IF102', nama: 'Basis Data', sks: 3 })
    try {
      db.addKurikulumMappings([
        { kurikulumId: kurikulum.id, mataKuliahId: first.id, semester: 'Ganjil', semesterKe: 1 },
        { kurikulumId: kurikulum.id, mataKuliahId: second.id, semester: 'Ganjil', semesterKe: 2 }
      ])
      assert.fail('expected parity mismatch to throw')
    } catch (error) {
      const err = error as { code?: string; message?: string }
      assert.equal(err.code, 'KURIKULUM_MAPPING_INVALID')
    }
    assert.deepEqual(db.listKurikulumMappings(kurikulum.id), [])
    const added = db.addKurikulumMappings([
      { kurikulumId: kurikulum.id, mataKuliahId: first.id, semester: 'Ganjil', semesterKe: 1 },
      { kurikulumId: kurikulum.id, mataKuliahId: second.id, semester: 'Ganjil', semesterKe: 3 }
    ])
    assert.equal(added.length, 2)
    assert.equal(db.listKurikulumMappings(kurikulum.id).length, 2)
  } finally {
    db.close()
  }
})

test('remove Kurikulum mapping drops it from the list', () => {
  const db = openPersistence(tempDbPath())
  try {
    const prodi = db.createProgramStudi({ kode: 'IF', nama: 'Informatika' })
    const kurikulum = db.createKurikulum({ programStudiId: prodi.id, nama: 'Kurikulum 2024' })
    const mk = db.createMataKuliah({ kode: 'IF101', nama: 'Algoritma', sks: 3 })
    const mapping = db.addKurikulumMapping({
      kurikulumId: kurikulum.id,
      mataKuliahId: mk.id,
      semester: 'Ganjil'
    })
    db.removeKurikulumMapping(mapping.id)
    assert.deepEqual(db.listKurikulumMappings(kurikulum.id), [])
  } finally {
    db.close()
  }
})

test('delete Program Studi is blocked while it still has Kurikulum', () => {
  const db = openPersistence(tempDbPath())
  try {
    const prodi = db.createProgramStudi({ kode: 'IF', nama: 'Informatika' })
    db.createKurikulum({ programStudiId: prodi.id, nama: 'Kurikulum 2024' })
    try {
      db.deleteProgramStudi(prodi.id)
      assert.fail('expected delete Program Studi to throw')
    } catch (error) {
      const err = error as { code?: string; message?: string }
      assert.equal(err.code, 'PROGRAM_STUDI_HAS_KURIKULUM')
    }
    assert.equal(db.listProgramStudi().length, 1)
    assert.equal(db.listKurikulum(prodi.id).length, 1)
  } finally {
    db.close()
  }
})

test('database at master-data schema version gains Kurikulum tables on open', () => {
  const path = tempDbPath()
  const legacy = new Database(path)
  legacy.exec(`
    CREATE TABLE waktu_sks (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      menit INTEGER NOT NULL CHECK (menit > 0)
    );
    INSERT INTO waktu_sks (id, menit) VALUES (1, 50);
    CREATE TABLE program_studi (
      id INTEGER PRIMARY KEY,
      kode TEXT NOT NULL UNIQUE,
      nama TEXT NOT NULL
    );
    CREATE TABLE mata_kuliah (
      id INTEGER PRIMARY KEY,
      kode TEXT NOT NULL UNIQUE,
      nama TEXT NOT NULL,
      sks INTEGER NOT NULL CHECK (sks > 0)
    );
    CREATE TABLE dosen (
      id INTEGER PRIMARY KEY,
      nama TEXT NOT NULL,
      gelar_depan TEXT,
      gelar_belakang TEXT,
      nidn TEXT,
      nuptk TEXT,
      CHECK (nidn IS NOT NULL OR nuptk IS NOT NULL)
    );
    CREATE UNIQUE INDEX dosen_nidn_unique ON dosen (nidn) WHERE nidn IS NOT NULL;
    CREATE UNIQUE INDEX dosen_nuptk_unique ON dosen (nuptk) WHERE nuptk IS NOT NULL;
  `)
  legacy.pragma('user_version = 2')
  legacy.close()

  const db = openPersistence(path)
  try {
    const prodi = db.createProgramStudi({ kode: 'IF', nama: 'Informatika' })
    const kurikulum = db.createKurikulum({ programStudiId: prodi.id, nama: 'Kurikulum 2024' })
    const mk = db.createMataKuliah({ kode: 'IF101', nama: 'Algoritma', sks: 3 })
    db.addKurikulumMapping({ kurikulumId: kurikulum.id, mataKuliahId: mk.id, semester: 'Ganjil' })
    assert.equal(db.listKurikulum(prodi.id).length, 1)
    assert.equal(db.listKurikulumMappings(kurikulum.id).length, 1)
  } finally {
    db.close()
  }
})

test('delete Kurikulum with mappings succeeds and then Mata Kuliah can be deleted', () => {
  const db = openPersistence(tempDbPath())
  try {
    const prodi = db.createProgramStudi({ kode: 'IF', nama: 'Informatika' })
    const kurikulum = db.createKurikulum({ programStudiId: prodi.id, nama: 'Kurikulum 2024' })
    const mk = db.createMataKuliah({ kode: 'IF101', nama: 'Algoritma', sks: 3 })
    db.addKurikulumMapping({ kurikulumId: kurikulum.id, mataKuliahId: mk.id, semester: 'Ganjil' })
    db.deleteKurikulum(kurikulum.id)
    assert.deepEqual(db.listKurikulum(prodi.id), [])
    db.deleteMataKuliah(mk.id)
    assert.deepEqual(db.listMataKuliah(), [])
    db.deleteProgramStudi(prodi.id)
    assert.deepEqual(db.listProgramStudi(), [])
  } finally {
    db.close()
  }
})

test('delete Mata Kuliah is blocked while a Kurikulum mapping references it', () => {
  const db = openPersistence(tempDbPath())
  try {
    const prodi = db.createProgramStudi({ kode: 'IF', nama: 'Informatika' })
    const kurikulum = db.createKurikulum({ programStudiId: prodi.id, nama: 'Kurikulum 2024' })
    const mk = db.createMataKuliah({ kode: 'IF101', nama: 'Algoritma', sks: 3 })
    db.addKurikulumMapping({ kurikulumId: kurikulum.id, mataKuliahId: mk.id, semester: 'Ganjil' })
    try {
      db.deleteMataKuliah(mk.id)
      assert.fail('expected delete Mata Kuliah to throw')
    } catch (error) {
      const err = error as { code?: string; message?: string }
      assert.equal(err.code, 'MATA_KULIAH_IN_KURIKULUM')
    }
    assert.equal(db.listMataKuliah().length, 1)
  } finally {
    db.close()
  }
})

function seedKurikulumWithMataKuliah(
  db: Persistence,
  semester: 'Ganjil' | 'Genap' = 'Ganjil'
): {
  programStudi: { id: number }
  kurikulum: { id: number }
  mataKuliah: { id: number; kode: string; nama: string; sks: number }
} {
  const programStudi = db.createProgramStudi({ kode: 'IF', nama: 'Informatika' })
  const kurikulum = db.createKurikulum({ programStudiId: programStudi.id, nama: 'Kurikulum 2024' })
  const mataKuliah = db.createMataKuliah({ kode: 'IF101', nama: 'Algoritma', sks: 3 })
  db.addKurikulumMapping({ kurikulumId: kurikulum.id, mataKuliahId: mataKuliah.id, semester })
  return { programStudi, kurikulum, mataKuliah }
}

function seedJadwalWithSnapshot(db: Persistence): {
  jadwal: { id: number }
  snapshot: { id: number; sks: number }
  dosen: { id: number }
} {
  const { programStudi, kurikulum } = seedKurikulumWithMataKuliah(db)
  const dosen = db.createDosen({ nama: 'Budi', nidn: '111', nuptk: null })
  const jadwal = db.createJadwal({
    programStudiId: programStudi.id,
    kurikulumId: kurikulum.id,
    tahunAkademik: '2026/2027',
    semester: 'Ganjil',
    jenisKelas: 'Reguler Pagi'
  })
  const snapshot = db.listJadwalSnapshots(jadwal.id)[0]!
  return { jadwal, snapshot, dosen }
}

test('create Jadwal copies Kurikulum MK for that semester and retains kurikulum provenance', () => {
  const db = openPersistence(tempDbPath())
  try {
    const { programStudi, kurikulum, mataKuliah } = seedKurikulumWithMataKuliah(db)
    const created = db.createJadwal({
      programStudiId: programStudi.id,
      kurikulumId: kurikulum.id,
      tahunAkademik: '2026/2027',
      semester: 'Ganjil',
      jenisKelas: 'Reguler Pagi'
    })
    assert.equal(typeof created.id, 'number')
    assert.equal(created.programStudiId, programStudi.id)
    assert.equal(created.kurikulumId, kurikulum.id)
    assert.equal(created.tahunAkademik, '2026/2027')
    assert.equal(created.semester, 'Ganjil')
    assert.equal(created.jenisKelas, 'Reguler Pagi')
    assert.deepEqual(db.listJadwal(programStudi.id), [created])
    assert.deepEqual(db.getJadwal(created.id), created)

    const snapshots = db.listJadwalSnapshots(created.id)
    assert.equal(snapshots.length, 1)
    assert.equal(snapshots[0]?.jadwalId, created.id)
    assert.equal(snapshots[0]?.kode, 'IF101')
    assert.equal(snapshots[0]?.nama, 'Algoritma')
    assert.equal(snapshots[0]?.sks, 3)
    assert.equal(snapshots[0]?.mataKuliahId, mataKuliah.id)
    assert.equal(snapshots[0]?.semesterKe, null)
  } finally {
    db.close()
  }
})

test('create Jadwal copies Semester ke onto the snapshot', () => {
  const db = openPersistence(tempDbPath())
  try {
    const { programStudi, kurikulum } = seedKurikulumWithMataKuliah(db)
    db.updateKurikulumMapping(
      db.listKurikulumMappings(kurikulum.id)[0]!.id,
      { semester: 'Ganjil', semesterKe: 3 }
    )
    const created = db.createJadwal({
      programStudiId: programStudi.id,
      kurikulumId: kurikulum.id,
      tahunAkademik: '2026/2027',
      semester: 'Ganjil',
      jenisKelas: 'Reguler Pagi'
    })
    assert.equal(db.listJadwalSnapshots(created.id)[0]?.semesterKe, 3)
    db.updateKurikulumMapping(
      db.listKurikulumMappings(kurikulum.id)[0]!.id,
      { semester: 'Ganjil', semesterKe: 5 }
    )
    assert.equal(db.listJadwalSnapshots(created.id)[0]?.semesterKe, 3)
    assert.equal(db.listKurikulumMappings(kurikulum.id)[0]?.semesterKe, 5)
  } finally {
    db.close()
  }
})

test('create Jadwal snapshots only the chosen semester Mata Kuliah', () => {
  const db = openPersistence(tempDbPath())
  try {
    const { programStudi, kurikulum } = seedKurikulumWithMataKuliah(db, 'Ganjil')
    const genap = db.createMataKuliah({ kode: 'IF201', nama: 'Basis Data', sks: 4 })
    db.addKurikulumMapping({ kurikulumId: kurikulum.id, mataKuliahId: genap.id, semester: 'Genap' })
    const created = db.createJadwal({
      programStudiId: programStudi.id,
      kurikulumId: kurikulum.id,
      tahunAkademik: '2026/2027',
      semester: 'Ganjil',
      jenisKelas: 'Reguler Pagi'
    })
    const snapshots = db.listJadwalSnapshots(created.id)
    assert.equal(snapshots.length, 1)
    assert.equal(snapshots[0]?.kode, 'IF101')
  } finally {
    db.close()
  }
})

test('create Jadwal is rejected when the Kurikulum has no Mata Kuliah for that semester', () => {
  const db = openPersistence(tempDbPath())
  try {
    const { programStudi, kurikulum } = seedKurikulumWithMataKuliah(db, 'Ganjil')
    try {
      db.createJadwal({
        programStudiId: programStudi.id,
        kurikulumId: kurikulum.id,
        tahunAkademik: '2026/2027',
        semester: 'Genap',
        jenisKelas: 'Reguler Pagi'
      })
      assert.fail('expected empty snapshot to throw')
    } catch (error) {
      const err = error as { code?: string; message?: string }
      assert.equal(err.code, 'JADWAL_SNAPSHOT_EMPTY')
    }
    assert.deepEqual(db.listJadwal(programStudi.id), [])
  } finally {
    db.close()
  }
})

test('duplicate Jadwal tuple is rejected; same tuple with another Jenis Kelas is allowed', () => {
  const db = openPersistence(tempDbPath())
  try {
    const { programStudi, kurikulum } = seedKurikulumWithMataKuliah(db)
    const pagi = db.createJadwal({
      programStudiId: programStudi.id,
      kurikulumId: kurikulum.id,
      tahunAkademik: '2026/2027',
      semester: 'Ganjil',
      jenisKelas: 'Reguler Pagi'
    })
    try {
      db.createJadwal({
        programStudiId: programStudi.id,
        kurikulumId: kurikulum.id,
        tahunAkademik: '2026/2027',
        semester: 'Ganjil',
        jenisKelas: 'Reguler Pagi'
      })
      assert.fail('expected duplicate Jadwal to throw')
    } catch (error) {
      const err = error as { code?: string; message?: string }
      assert.equal(err.code, 'JADWAL_DUPLICATE')
    }
    const sore = db.createJadwal({
      programStudiId: programStudi.id,
      kurikulumId: kurikulum.id,
      tahunAkademik: '2026/2027',
      semester: 'Ganjil',
      jenisKelas: 'Reguler Sore'
    })
    assert.equal(sore.jenisKelas, 'Reguler Sore')
    assert.deepEqual(db.listJadwal(programStudi.id), [pagi, sore])
  } finally {
    db.close()
  }
})

test('Jadwal with invalid Jenis Kelas, Semester, or empty Tahun Akademik is rejected', () => {
  const db = openPersistence(tempDbPath())
  try {
    const { programStudi, kurikulum } = seedKurikulumWithMataKuliah(db)
    try {
      db.createJadwal({
        programStudiId: programStudi.id,
        kurikulumId: kurikulum.id,
        tahunAkademik: '2026/2027',
        semester: 'Ganjil',
        jenisKelas: 'Karyawan' as 'Reguler Pagi'
      })
      assert.fail('expected invalid Jenis Kelas to throw')
    } catch (error) {
      const err = error as { code?: string; message?: string }
      assert.equal(err.code, 'JADWAL_INVALID')
      assert.match(String(err.message), /Reguler Pagi|Reguler Sore/)
    }
    try {
      db.createJadwal({
        programStudiId: programStudi.id,
        kurikulumId: kurikulum.id,
        tahunAkademik: '2026/2027',
        semester: 'Pendek' as 'Ganjil',
        jenisKelas: 'Reguler Pagi'
      })
      assert.fail('expected invalid Semester to throw')
    } catch (error) {
      const err = error as { code?: string; message?: string }
      assert.equal(err.code, 'JADWAL_INVALID')
      assert.match(String(err.message), /Ganjil|Genap/)
    }
    try {
      db.createJadwal({
        programStudiId: programStudi.id,
        kurikulumId: kurikulum.id,
        tahunAkademik: '  ',
        semester: 'Ganjil',
        jenisKelas: 'Reguler Pagi'
      })
      assert.fail('expected empty Tahun Akademik to throw')
    } catch (error) {
      const err = error as { code?: string; message?: string }
      assert.equal(err.code, 'JADWAL_INVALID')
    }
    assert.deepEqual(db.listJadwal(programStudi.id), [])
  } finally {
    db.close()
  }
})

test('Jadwal snapshot stays frozen after Kurikulum or catalog Mata Kuliah changes', () => {
  const db = openPersistence(tempDbPath())
  try {
    const { programStudi, kurikulum, mataKuliah } = seedKurikulumWithMataKuliah(db)
    const created = db.createJadwal({
      programStudiId: programStudi.id,
      kurikulumId: kurikulum.id,
      tahunAkademik: '2026/2027',
      semester: 'Ganjil',
      jenisKelas: 'Reguler Pagi'
    })
    const extra = db.createMataKuliah({ kode: 'IF102', nama: 'Pemrograman', sks: 2 })
    db.addKurikulumMapping({
      kurikulumId: kurikulum.id,
      mataKuliahId: extra.id,
      semester: 'Ganjil'
    })
    db.updateMataKuliah(mataKuliah.id, { kode: 'IF199', nama: 'Algoritma Lanjut', sks: 4 })
    const snapshots = db.listJadwalSnapshots(created.id)
    assert.equal(snapshots.length, 1)
    assert.equal(snapshots[0]?.kode, 'IF101')
    assert.equal(snapshots[0]?.nama, 'Algoritma')
    assert.equal(snapshots[0]?.sks, 3)
    assert.equal(db.getJadwal(created.id).kurikulumId, kurikulum.id)
  } finally {
    db.close()
  }
})

test('delete Jadwal removes it and its snapshot rows', () => {
  const db = openPersistence(tempDbPath())
  try {
    const { programStudi, kurikulum } = seedKurikulumWithMataKuliah(db)
    const created = db.createJadwal({
      programStudiId: programStudi.id,
      kurikulumId: kurikulum.id,
      tahunAkademik: '2026/2027',
      semester: 'Ganjil',
      jenisKelas: 'Reguler Pagi'
    })
    db.deleteJadwal(created.id)
    assert.deepEqual(db.listJadwal(programStudi.id), [])
    assert.deepEqual(db.listJadwalSnapshots(created.id), [])
    try {
      db.getJadwal(created.id)
      assert.fail('expected get deleted Jadwal to throw')
    } catch (error) {
      const err = error as { code?: string; message?: string }
      assert.equal(err.code, 'JADWAL_NOT_FOUND')
    }
    assert.equal(db.listKurikulum(programStudi.id).length, 1)
  } finally {
    db.close()
  }
})

test('delete Kurikulum is blocked while any Jadwal references it', () => {
  const db = openPersistence(tempDbPath())
  try {
    const { programStudi, kurikulum } = seedKurikulumWithMataKuliah(db)
    db.createJadwal({
      programStudiId: programStudi.id,
      kurikulumId: kurikulum.id,
      tahunAkademik: '2026/2027',
      semester: 'Ganjil',
      jenisKelas: 'Reguler Pagi'
    })
    try {
      db.deleteKurikulum(kurikulum.id)
      assert.fail('expected delete Kurikulum to throw')
    } catch (error) {
      const err = error as { code?: string; message?: string }
      assert.equal(err.code, 'KURIKULUM_HAS_JADWAL')
    }
    assert.equal(db.listKurikulum(programStudi.id).length, 1)
  } finally {
    db.close()
  }
})

test('snapshot rows keep copied fields after catalog Mata Kuliah is unmapped and deleted', () => {
  const db = openPersistence(tempDbPath())
  try {
    const { programStudi, kurikulum, mataKuliah } = seedKurikulumWithMataKuliah(db)
    const mapping = db.listKurikulumMappings(kurikulum.id)[0]
    const created = db.createJadwal({
      programStudiId: programStudi.id,
      kurikulumId: kurikulum.id,
      tahunAkademik: '2026/2027',
      semester: 'Ganjil',
      jenisKelas: 'Reguler Pagi'
    })
    db.removeKurikulumMapping(mapping!.id)
    db.deleteMataKuliah(mataKuliah.id)
    assert.deepEqual(db.listMataKuliah(), [])
    const snapshots = db.listJadwalSnapshots(created.id)
    assert.equal(snapshots.length, 1)
    assert.equal(snapshots[0]?.kode, 'IF101')
    assert.equal(snapshots[0]?.nama, 'Algoritma')
    assert.equal(snapshots[0]?.sks, 3)
    assert.equal(snapshots[0]?.mataKuliahId, null)
  } finally {
    db.close()
  }
})

test('database at Kurikulum schema version gains Jadwal tables on open', () => {
  const path = tempDbPath()
  const legacy = new Database(path)
  legacy.exec(`
    CREATE TABLE waktu_sks (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      menit INTEGER NOT NULL CHECK (menit > 0)
    );
    INSERT INTO waktu_sks (id, menit) VALUES (1, 50);
    CREATE TABLE program_studi (
      id INTEGER PRIMARY KEY,
      kode TEXT NOT NULL UNIQUE,
      nama TEXT NOT NULL
    );
    CREATE TABLE mata_kuliah (
      id INTEGER PRIMARY KEY,
      kode TEXT NOT NULL UNIQUE,
      nama TEXT NOT NULL,
      sks INTEGER NOT NULL CHECK (sks > 0)
    );
    CREATE TABLE dosen (
      id INTEGER PRIMARY KEY,
      nama TEXT NOT NULL,
      gelar_depan TEXT,
      gelar_belakang TEXT,
      nidn TEXT,
      nuptk TEXT,
      CHECK (nidn IS NOT NULL OR nuptk IS NOT NULL)
    );
    CREATE UNIQUE INDEX dosen_nidn_unique ON dosen (nidn) WHERE nidn IS NOT NULL;
    CREATE UNIQUE INDEX dosen_nuptk_unique ON dosen (nuptk) WHERE nuptk IS NOT NULL;
    CREATE TABLE kurikulum (
      id INTEGER PRIMARY KEY,
      program_studi_id INTEGER NOT NULL REFERENCES program_studi(id),
      nama TEXT NOT NULL,
      UNIQUE (program_studi_id, nama)
    );
    CREATE TABLE kurikulum_mata_kuliah (
      id INTEGER PRIMARY KEY,
      kurikulum_id INTEGER NOT NULL REFERENCES kurikulum(id) ON DELETE CASCADE,
      mata_kuliah_id INTEGER NOT NULL REFERENCES mata_kuliah(id),
      semester TEXT NOT NULL CHECK (semester IN ('Ganjil', 'Genap')),
      UNIQUE (kurikulum_id, mata_kuliah_id)
    );
  `)
  legacy.pragma('user_version = 3')
  legacy.close()

  const db = openPersistence(path)
  try {
    const { programStudi, kurikulum } = seedKurikulumWithMataKuliah(db)
    const created = db.createJadwal({
      programStudiId: programStudi.id,
      kurikulumId: kurikulum.id,
      tahunAkademik: '2026/2027',
      semester: 'Ganjil',
      jenisKelas: 'Reguler Pagi'
    })
    assert.equal(db.listJadwal(programStudi.id).length, 1)
    assert.equal(db.listJadwalSnapshots(created.id).length, 1)
  } finally {
    db.close()
  }
})

test('create Kelas then list returns dosen, hari, and jam mulai', () => {
  const db = openPersistence(tempDbPath())
  try {
    const { jadwal, snapshot, dosen } = seedJadwalWithSnapshot(db)
    const created = db.createKelas({
      jadwalId: jadwal.id,
      snapshotMkId: snapshot.id,
      dosenId: dosen.id,
      hari: 1,
      jamMulai: 480
    })
    assert.equal(typeof created.id, 'number')
    assert.equal(created.jadwalId, jadwal.id)
    assert.equal(created.snapshotMkId, snapshot.id)
    assert.equal(created.dosenId, dosen.id)
    assert.equal(created.hari, 1)
    assert.equal(created.jamMulai, 480)
    assert.deepEqual(db.listKelas(jadwal.id), [created])
  } finally {
    db.close()
  }
})

test('second Kelas on the same snapped Mata Kuliah is rejected', () => {
  const db = openPersistence(tempDbPath())
  try {
    const { jadwal, snapshot, dosen } = seedJadwalWithSnapshot(db)
    db.createKelas({
      jadwalId: jadwal.id,
      snapshotMkId: snapshot.id,
      dosenId: dosen.id,
      hari: 1,
      jamMulai: 480
    })
    try {
      db.createKelas({
        jadwalId: jadwal.id,
        snapshotMkId: snapshot.id,
        dosenId: dosen.id,
        hari: 2,
        jamMulai: 540
      })
      assert.fail('expected duplicate Kelas to throw')
    } catch (error) {
      const err = error as { code?: string; message?: string }
      assert.equal(err.code, 'KELAS_DUPLICATE')
    }
    assert.equal(db.listKelas(jadwal.id).length, 1)
  } finally {
    db.close()
  }
})

test('update Kelas changes dosen, hari, and jam mulai', () => {
  const db = openPersistence(tempDbPath())
  try {
    const { jadwal, snapshot, dosen } = seedJadwalWithSnapshot(db)
    const otherDosen = db.createDosen({ nama: 'Ani', nidn: '222', nuptk: null })
    const created = db.createKelas({
      jadwalId: jadwal.id,
      snapshotMkId: snapshot.id,
      dosenId: dosen.id,
      hari: 1,
      jamMulai: 480
    })
    const updated = db.updateKelas(created.id, {
      jadwalId: 0,
      snapshotMkId: 0,
      dosenId: otherDosen.id,
      hari: 3,
      jamMulai: 600
    })
    assert.equal(updated.id, created.id)
    assert.equal(updated.jadwalId, jadwal.id)
    assert.equal(updated.snapshotMkId, snapshot.id)
    assert.equal(updated.dosenId, otherDosen.id)
    assert.equal(updated.hari, 3)
    assert.equal(updated.jamMulai, 600)
    assert.deepEqual(db.listKelas(jadwal.id), [updated])
  } finally {
    db.close()
  }
})

test('delete Kelas removes it so the snapped Mata Kuliah has no Kelas', () => {
  const db = openPersistence(tempDbPath())
  try {
    const { jadwal, snapshot, dosen } = seedJadwalWithSnapshot(db)
    const created = db.createKelas({
      jadwalId: jadwal.id,
      snapshotMkId: snapshot.id,
      dosenId: dosen.id,
      hari: 1,
      jamMulai: 480
    })
    db.deleteKelas(created.id)
    assert.deepEqual(db.listKelas(jadwal.id), [])
  } finally {
    db.close()
  }
})

test('Kelas can be created without dosen, hari, or jam mulai', () => {
  const db = openPersistence(tempDbPath())
  try {
    const { jadwal, snapshot } = seedJadwalWithSnapshot(db)
    const created = db.createKelas({
      jadwalId: jadwal.id,
      snapshotMkId: snapshot.id
    })
    assert.equal(created.dosenId, null)
    assert.equal(created.hari, null)
    assert.equal(created.jamMulai, null)
    assert.equal(created.jamSelesai, null)
    assert.deepEqual(db.listKelas(jadwal.id), [created])
  } finally {
    db.close()
  }
})

test('derived jam selesai is jam mulai plus snapshot sks times current Waktu SKS', () => {
  const db = openPersistence(tempDbPath())
  try {
    const { jadwal, snapshot, dosen } = seedJadwalWithSnapshot(db)
    assert.equal(snapshot.sks, 3)
    assert.deepEqual(db.getWaktuSks(), { menit: 50, potonganSoreAktif: true })
    const created = db.createKelas({
      jadwalId: jadwal.id,
      snapshotMkId: snapshot.id,
      dosenId: dosen.id,
      hari: 1,
      jamMulai: 480
    })
    assert.equal(created.jamSelesai, 630)
    assert.equal(db.listKelas(jadwal.id)[0]?.jamSelesai, 630)

    db.updateWaktuSks({ menit: 45, potonganSoreAktif: true })
    assert.equal(db.listKelas(jadwal.id)[0]?.jamSelesai, 615)
  } finally {
    db.close()
  }
})

test('Reguler Sore jam selesai uses Waktu SKS minus 10 per SKS when Potongan Sore is aktif', () => {
  const db = openPersistence(tempDbPath())
  try {
    const { programStudi, kurikulum, mataKuliah } = seedKurikulumWithMataKuliah(db)
    const dosen = db.createDosen({ nama: 'Ada', nidn: '1', nuptk: null })
    const sore = db.createJadwal({
      programStudiId: programStudi.id,
      kurikulumId: kurikulum.id,
      tahunAkademik: '2026/2027',
      semester: 'Ganjil',
      jenisKelas: 'Reguler Sore'
    })
    const snapshot = db.listJadwalSnapshots(sore.id)[0]!
    assert.equal(snapshot.sks, mataKuliah.sks)
    assert.deepEqual(db.getWaktuSks(), { menit: 50, potonganSoreAktif: true })
    const created = db.createKelas({
      jadwalId: sore.id,
      snapshotMkId: snapshot.id,
      dosenId: dosen.id,
      hari: 1,
      jamMulai: 960
    })
    // 960 + 3 * (50 - 10) = 1080
    assert.equal(created.jamSelesai, 1080)

    db.updateWaktuSks({ menit: 50, potonganSoreAktif: false })
    assert.equal(db.listKelas(sore.id)[0]?.jamSelesai, 1110)
  } finally {
    db.close()
  }
})

test('Potongan Sore cannot stay aktif when Waktu SKS is 10 or less', () => {
  const db = openPersistence(tempDbPath())
  try {
    try {
      db.updateWaktuSks({ menit: 10, potonganSoreAktif: true })
      assert.fail('expected update to throw')
    } catch (error) {
      const err = error as { code?: string }
      assert.equal(err.code, 'WAKTU_SKS_INVALID')
    }
    db.updateWaktuSks({ menit: 10, potonganSoreAktif: false })
    assert.deepEqual(db.getWaktuSks(), { menit: 10, potonganSoreAktif: false })
  } finally {
    db.close()
  }
})

test('delete Dosen is blocked while any Kelas still assigns them', () => {
  const db = openPersistence(tempDbPath())
  try {
    const { jadwal, snapshot, dosen } = seedJadwalWithSnapshot(db)
    db.createKelas({
      jadwalId: jadwal.id,
      snapshotMkId: snapshot.id,
      dosenId: dosen.id,
      hari: 1,
      jamMulai: 480
    })
    try {
      db.deleteDosen(dosen.id)
      assert.fail('expected delete Dosen to throw')
    } catch (error) {
      const err = error as { code?: string; message?: string }
      assert.equal(err.code, 'DOSEN_HAS_KELAS')
    }
    assert.equal(db.listDosen().length, 1)
    assert.equal(db.listKelas(jadwal.id).length, 1)
  } finally {
    db.close()
  }
})

test('Kelas with hari outside 1-7 or negative jam mulai is rejected', () => {
  const db = openPersistence(tempDbPath())
  try {
    const { jadwal, snapshot, dosen } = seedJadwalWithSnapshot(db)
    try {
      db.createKelas({
        jadwalId: jadwal.id,
        snapshotMkId: snapshot.id,
        dosenId: dosen.id,
        hari: 8,
        jamMulai: 480
      })
      assert.fail('expected invalid hari to throw')
    } catch (error) {
      const err = error as { code?: string; message?: string }
      assert.equal(err.code, 'KELAS_INVALID')
      assert.match(String(err.message), /hari/i)
    }
    try {
      db.createKelas({
        jadwalId: jadwal.id,
        snapshotMkId: snapshot.id,
        dosenId: dosen.id,
        hari: 1,
        jamMulai: -1
      })
      assert.fail('expected negative jam mulai to throw')
    } catch (error) {
      const err = error as { code?: string; message?: string }
      assert.equal(err.code, 'KELAS_INVALID')
    }
    assert.deepEqual(db.listKelas(jadwal.id), [])
  } finally {
    db.close()
  }
})

test('Reguler Sore allows jam mulai before 16:00 (window is soft UI only)', () => {
  const db = openPersistence(tempDbPath())
  try {
    const { programStudi, kurikulum } = seedKurikulumWithMataKuliah(db)
    const dosen = db.createDosen({ nama: 'Budi', nidn: '111', nuptk: null })
    const sore = db.createJadwal({
      programStudiId: programStudi.id,
      kurikulumId: kurikulum.id,
      tahunAkademik: '2026/2027',
      semester: 'Ganjil',
      jenisKelas: 'Reguler Sore'
    })
    const snapshot = db.listJadwalSnapshots(sore.id)[0]!
    const created = db.createKelas({
      jadwalId: sore.id,
      snapshotMkId: snapshot.id,
      dosenId: dosen.id,
      hari: 1,
      jamMulai: 480
    })
    assert.equal(created.jamMulai, 480)
    const updated = db.updateKelas(created.id, {
      jadwalId: sore.id,
      snapshotMkId: snapshot.id,
      dosenId: dosen.id,
      hari: 1,
      jamMulai: 960
    })
    assert.equal(updated.jamMulai, 960)
  } finally {
    db.close()
  }
})

test('delete Jadwal cascades its Kelas', () => {
  const db = openPersistence(tempDbPath())
  try {
    const { jadwal, snapshot, dosen } = seedJadwalWithSnapshot(db)
    db.createKelas({
      jadwalId: jadwal.id,
      snapshotMkId: snapshot.id,
      dosenId: dosen.id,
      hari: 1,
      jamMulai: 480
    })
    db.deleteJadwal(jadwal.id)
    assert.deepEqual(db.listKelas(jadwal.id), [])
  } finally {
    db.close()
  }
})

test('database at Jadwal schema version gains Kelas table on open', () => {
  const path = tempDbPath()
  const legacy = new Database(path)
  legacy.exec(`
    CREATE TABLE waktu_sks (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      menit INTEGER NOT NULL CHECK (menit > 0)
    );
    INSERT INTO waktu_sks (id, menit) VALUES (1, 50);
    CREATE TABLE program_studi (
      id INTEGER PRIMARY KEY,
      kode TEXT NOT NULL UNIQUE,
      nama TEXT NOT NULL
    );
    CREATE TABLE mata_kuliah (
      id INTEGER PRIMARY KEY,
      kode TEXT NOT NULL UNIQUE,
      nama TEXT NOT NULL,
      sks INTEGER NOT NULL CHECK (sks > 0)
    );
    CREATE TABLE dosen (
      id INTEGER PRIMARY KEY,
      nama TEXT NOT NULL,
      gelar_depan TEXT,
      gelar_belakang TEXT,
      nidn TEXT,
      nuptk TEXT,
      CHECK (nidn IS NOT NULL OR nuptk IS NOT NULL)
    );
    CREATE UNIQUE INDEX dosen_nidn_unique ON dosen (nidn) WHERE nidn IS NOT NULL;
    CREATE UNIQUE INDEX dosen_nuptk_unique ON dosen (nuptk) WHERE nuptk IS NOT NULL;
    CREATE TABLE kurikulum (
      id INTEGER PRIMARY KEY,
      program_studi_id INTEGER NOT NULL REFERENCES program_studi(id),
      nama TEXT NOT NULL,
      UNIQUE (program_studi_id, nama)
    );
    CREATE TABLE kurikulum_mata_kuliah (
      id INTEGER PRIMARY KEY,
      kurikulum_id INTEGER NOT NULL REFERENCES kurikulum(id) ON DELETE CASCADE,
      mata_kuliah_id INTEGER NOT NULL REFERENCES mata_kuliah(id),
      semester TEXT NOT NULL CHECK (semester IN ('Ganjil', 'Genap')),
      UNIQUE (kurikulum_id, mata_kuliah_id)
    );
    CREATE TABLE jadwal (
      id INTEGER PRIMARY KEY,
      program_studi_id INTEGER NOT NULL REFERENCES program_studi(id),
      kurikulum_id INTEGER NOT NULL REFERENCES kurikulum(id),
      tahun_akademik TEXT NOT NULL,
      semester TEXT NOT NULL CHECK (semester IN ('Ganjil', 'Genap')),
      jenis_kelas TEXT NOT NULL CHECK (jenis_kelas IN ('Reguler Pagi', 'Reguler Sore')),
      UNIQUE (program_studi_id, tahun_akademik, semester, jenis_kelas)
    );
    CREATE TABLE jadwal_snapshot (
      id INTEGER PRIMARY KEY,
      jadwal_id INTEGER NOT NULL REFERENCES jadwal(id) ON DELETE CASCADE,
      kode TEXT NOT NULL,
      nama TEXT NOT NULL,
      sks INTEGER NOT NULL CHECK (sks > 0),
      mata_kuliah_id INTEGER REFERENCES mata_kuliah(id) ON DELETE SET NULL
    );
  `)
  legacy.pragma('user_version = 4')
  legacy.close()

  const db = openPersistence(path)
  try {
    const { jadwal, snapshot, dosen } = seedJadwalWithSnapshot(db)
    db.createKelas({
      jadwalId: jadwal.id,
      snapshotMkId: snapshot.id,
      dosenId: dosen.id,
      hari: 1,
      jamMulai: 480
    })
    assert.equal(db.listKelas(jadwal.id).length, 1)
  } finally {
    db.close()
  }
})

test('database at Kelas schema version gains Semester ke columns on open', () => {
  const path = tempDbPath()
  const legacy = new Database(path)
  legacy.exec(`
    CREATE TABLE waktu_sks (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      menit INTEGER NOT NULL CHECK (menit > 0)
    );
    INSERT INTO waktu_sks (id, menit) VALUES (1, 50);
    CREATE TABLE program_studi (
      id INTEGER PRIMARY KEY,
      kode TEXT NOT NULL UNIQUE,
      nama TEXT NOT NULL
    );
    CREATE TABLE mata_kuliah (
      id INTEGER PRIMARY KEY,
      kode TEXT NOT NULL UNIQUE,
      nama TEXT NOT NULL,
      sks INTEGER NOT NULL CHECK (sks > 0)
    );
    CREATE TABLE dosen (
      id INTEGER PRIMARY KEY,
      nama TEXT NOT NULL,
      gelar_depan TEXT,
      gelar_belakang TEXT,
      nidn TEXT,
      nuptk TEXT,
      CHECK (nidn IS NOT NULL OR nuptk IS NOT NULL)
    );
    CREATE UNIQUE INDEX dosen_nidn_unique ON dosen (nidn) WHERE nidn IS NOT NULL;
    CREATE UNIQUE INDEX dosen_nuptk_unique ON dosen (nuptk) WHERE nuptk IS NOT NULL;
    CREATE TABLE kurikulum (
      id INTEGER PRIMARY KEY,
      program_studi_id INTEGER NOT NULL REFERENCES program_studi(id),
      nama TEXT NOT NULL,
      UNIQUE (program_studi_id, nama)
    );
    CREATE TABLE kurikulum_mata_kuliah (
      id INTEGER PRIMARY KEY,
      kurikulum_id INTEGER NOT NULL REFERENCES kurikulum(id) ON DELETE CASCADE,
      mata_kuliah_id INTEGER NOT NULL REFERENCES mata_kuliah(id),
      semester TEXT NOT NULL CHECK (semester IN ('Ganjil', 'Genap')),
      UNIQUE (kurikulum_id, mata_kuliah_id)
    );
    CREATE TABLE jadwal (
      id INTEGER PRIMARY KEY,
      program_studi_id INTEGER NOT NULL REFERENCES program_studi(id),
      kurikulum_id INTEGER NOT NULL REFERENCES kurikulum(id),
      tahun_akademik TEXT NOT NULL,
      semester TEXT NOT NULL CHECK (semester IN ('Ganjil', 'Genap')),
      jenis_kelas TEXT NOT NULL CHECK (jenis_kelas IN ('Reguler Pagi', 'Reguler Sore')),
      UNIQUE (program_studi_id, tahun_akademik, semester, jenis_kelas)
    );
    CREATE TABLE jadwal_snapshot (
      id INTEGER PRIMARY KEY,
      jadwal_id INTEGER NOT NULL REFERENCES jadwal(id) ON DELETE CASCADE,
      kode TEXT NOT NULL,
      nama TEXT NOT NULL,
      sks INTEGER NOT NULL CHECK (sks > 0),
      mata_kuliah_id INTEGER REFERENCES mata_kuliah(id) ON DELETE SET NULL
    );
    CREATE TABLE kelas (
      id INTEGER PRIMARY KEY,
      jadwal_id INTEGER NOT NULL REFERENCES jadwal(id) ON DELETE CASCADE,
      snapshot_mk_id INTEGER NOT NULL REFERENCES jadwal_snapshot(id) ON DELETE CASCADE,
      dosen_id INTEGER REFERENCES dosen(id),
      hari INTEGER CHECK (hari IS NULL OR (hari >= 1 AND hari <= 7)),
      jam_mulai INTEGER CHECK (jam_mulai IS NULL OR jam_mulai >= 0),
      UNIQUE (jadwal_id, snapshot_mk_id)
    );
  `)
  legacy.pragma('user_version = 5')
  legacy.close()

  const db = openPersistence(path)
  try {
    const { programStudi, kurikulum } = seedKurikulumWithMataKuliah(db)
    db.updateKurikulumMapping(
      db.listKurikulumMappings(kurikulum.id)[0]!.id,
      { semester: 'Ganjil', semesterKe: 1 }
    )
    const created = db.createJadwal({
      programStudiId: programStudi.id,
      kurikulumId: kurikulum.id,
      tahunAkademik: '2026/2027',
      semester: 'Ganjil',
      jenisKelas: 'Reguler Pagi'
    })
    assert.equal(db.listKurikulumMappings(kurikulum.id)[0]?.semesterKe, 1)
    assert.equal(db.listJadwalSnapshots(created.id)[0]?.semesterKe, 1)
  } finally {
    db.close()
  }
})

test('listBentrok for unknown Jadwal is rejected with structured error', () => {
  const db = openPersistence(tempDbPath())
  try {
    try {
      db.listBentrok(999)
      assert.fail('expected listBentrok to throw')
    } catch (error) {
      const err = error as { code?: string; message?: string }
      assert.equal(err.code, 'JADWAL_NOT_FOUND')
    }
  } finally {
    db.close()
  }
})

test('listBentrokSemesterKe for unknown Jadwal is rejected with structured error', () => {
  const db = openPersistence(tempDbPath())
  try {
    try {
      db.listBentrokSemesterKe(999)
      assert.fail('expected listBentrokSemesterKe to throw')
    } catch (error) {
      const err = error as { code?: string; message?: string }
      assert.equal(err.code, 'JADWAL_NOT_FOUND')
    }
  } finally {
    db.close()
  }
})

test('overlapping Kelas on the same Semester ke produce two denormalized Bentrok Semester ke entries', () => {
  const db = openPersistence(tempDbPath())
  try {
    const { jadwal, snapshots } = seedJadwalWithTwoSnapshotsSameKe(db, 3)
    const first = db.createKelas({
      jadwalId: jadwal.id,
      snapshotMkId: snapshots[0]!.id,
      hari: 1,
      jamMulai: 480
    })
    const second = db.createKelas({
      jadwalId: jadwal.id,
      snapshotMkId: snapshots[1]!.id,
      hari: 1,
      jamMulai: 540
    })
    assert.equal(first.jamSelesai, 630)
    assert.equal(second.jamSelesai, 640)

    const rows = db.listBentrokSemesterKe(jadwal.id)
    assert.equal(rows.length, 2)
    const byKelas = new Map(rows.map((row) => [row.kelasId, row]))
    const firstRow = byKelas.get(first.id)
    const secondRow = byKelas.get(second.id)
    assert.ok(firstRow)
    assert.ok(secondRow)

    assert.equal(firstRow.semesterKe, 3)
    assert.equal(firstRow.hari, 1)
    assert.equal(firstRow.jamMulai, 480)
    assert.equal(firstRow.jamSelesai, 630)
    assert.equal(firstRow.otherKelasId, second.id)
    assert.equal(firstRow.otherMkKode, 'IF102')
    assert.equal(firstRow.otherMkNama, 'Pemrograman')
    assert.equal(firstRow.otherJamMulai, 540)
    assert.equal(firstRow.otherJamSelesai, 640)

    assert.equal(secondRow.semesterKe, 3)
    assert.equal(secondRow.otherKelasId, first.id)
    assert.equal(secondRow.otherMkKode, 'IF101')
    assert.equal(secondRow.otherMkNama, 'Algoritma')
  } finally {
    db.close()
  }
})

test('Kelas that only touch at jam selesai are not Bentrok Semester ke', () => {
  const db = openPersistence(tempDbPath())
  try {
    const { jadwal, snapshots } = seedJadwalWithTwoSnapshotsSameKe(db, 1)
    db.createKelas({
      jadwalId: jadwal.id,
      snapshotMkId: snapshots[0]!.id,
      hari: 1,
      jamMulai: 480
    })
    db.createKelas({
      jadwalId: jadwal.id,
      snapshotMkId: snapshots[1]!.id,
      hari: 1,
      jamMulai: 630
    })
    assert.deepEqual(db.listBentrokSemesterKe(jadwal.id), [])
  } finally {
    db.close()
  }
})

test('Kelas without hari or jam mulai are excluded from Bentrok Semester ke', () => {
  const db = openPersistence(tempDbPath())
  try {
    const { jadwal, snapshots } = seedJadwalWithTwoSnapshotsSameKe(db, 1)
    db.createKelas({
      jadwalId: jadwal.id,
      snapshotMkId: snapshots[0]!.id,
      hari: 1,
      jamMulai: 480
    })
    db.createKelas({
      jadwalId: jadwal.id,
      snapshotMkId: snapshots[1]!.id,
      hari: 1
    })
    assert.deepEqual(db.listBentrokSemesterKe(jadwal.id), [])
  } finally {
    db.close()
  }
})

test('different Semester ke on the same Jadwal are not Bentrok Semester ke', () => {
  const db = openPersistence(tempDbPath())
  try {
    const { jadwal, snapshots } = seedJadwalWithTwoSnapshotsDifferentKe(db)
    db.createKelas({
      jadwalId: jadwal.id,
      snapshotMkId: snapshots[0]!.id,
      hari: 1,
      jamMulai: 480
    })
    db.createKelas({
      jadwalId: jadwal.id,
      snapshotMkId: snapshots[1]!.id,
      hari: 1,
      jamMulai: 480
    })
    assert.deepEqual(db.listBentrokSemesterKe(jadwal.id), [])
  } finally {
    db.close()
  }
})

test('null Semester ke Kelas are ignored by Bentrok Semester ke', () => {
  const db = openPersistence(tempDbPath())
  try {
    const { jadwal, snapshots } = seedJadwalWithTwoSnapshots(db)
    assert.equal(snapshots[0]?.semesterKe, null)
    assert.equal(snapshots[1]?.semesterKe, null)
    db.createKelas({
      jadwalId: jadwal.id,
      snapshotMkId: snapshots[0]!.id,
      hari: 1,
      jamMulai: 480
    })
    db.createKelas({
      jadwalId: jadwal.id,
      snapshotMkId: snapshots[1]!.id,
      hari: 1,
      jamMulai: 480
    })
    assert.deepEqual(db.listBentrokSemesterKe(jadwal.id), [])
  } finally {
    db.close()
  }
})

test('Bentrok Semester ke does not compare across Jadwal', () => {
  const db = openPersistence(tempDbPath())
  try {
    const { programStudi, kurikulum, jadwal, snapshots } = seedJadwalWithTwoSnapshotsSameKe(db, 1)
    const sore = db.createJadwal({
      programStudiId: programStudi.id,
      kurikulumId: kurikulum.id,
      tahunAkademik: '2026/2027',
      semester: 'Ganjil',
      jenisKelas: 'Reguler Sore'
    })
    const soreSnapshots = db.listJadwalSnapshots(sore.id)
    db.createKelas({
      jadwalId: jadwal.id,
      snapshotMkId: snapshots[0]!.id,
      hari: 1,
      jamMulai: 480
    })
    db.createKelas({
      jadwalId: sore.id,
      snapshotMkId: soreSnapshots[0]!.id,
      hari: 1,
      jamMulai: 960
    })
    assert.deepEqual(db.listBentrokSemesterKe(jadwal.id), [])
    assert.deepEqual(db.listBentrokSemesterKe(sore.id), [])
  } finally {
    db.close()
  }
})

function seedJadwalWithTwoSnapshotsSameKe(
  db: Persistence,
  semesterKe: number
): {
  programStudi: { id: number; nama: string }
  kurikulum: { id: number }
  jadwal: { id: number }
  snapshots: Array<{ id: number; kode: string; nama: string; sks: number; semesterKe: number | null }>
} {
  const programStudi = db.createProgramStudi({ kode: 'IF', nama: 'Informatika' })
  const kurikulum = db.createKurikulum({ programStudiId: programStudi.id, nama: 'Kurikulum 2024' })
  const mk1 = db.createMataKuliah({ kode: 'IF101', nama: 'Algoritma', sks: 3 })
  const mk2 = db.createMataKuliah({ kode: 'IF102', nama: 'Pemrograman', sks: 2 })
  db.addKurikulumMappings([
    { kurikulumId: kurikulum.id, mataKuliahId: mk1.id, semester: 'Ganjil', semesterKe },
    { kurikulumId: kurikulum.id, mataKuliahId: mk2.id, semester: 'Ganjil', semesterKe }
  ])
  const jadwal = db.createJadwal({
    programStudiId: programStudi.id,
    kurikulumId: kurikulum.id,
    tahunAkademik: '2026/2027',
    semester: 'Ganjil',
    jenisKelas: 'Reguler Pagi'
  })
  return {
    programStudi,
    kurikulum,
    jadwal,
    snapshots: db.listJadwalSnapshots(jadwal.id)
  }
}

function seedJadwalWithTwoSnapshotsDifferentKe(db: Persistence): {
  jadwal: { id: number }
  snapshots: Array<{ id: number; kode: string; nama: string; sks: number; semesterKe: number | null }>
} {
  const programStudi = db.createProgramStudi({ kode: 'IF', nama: 'Informatika' })
  const kurikulum = db.createKurikulum({ programStudiId: programStudi.id, nama: 'Kurikulum 2024' })
  const mk1 = db.createMataKuliah({ kode: 'IF101', nama: 'Algoritma', sks: 3 })
  const mk2 = db.createMataKuliah({ kode: 'IF102', nama: 'Pemrograman', sks: 2 })
  db.addKurikulumMappings([
    { kurikulumId: kurikulum.id, mataKuliahId: mk1.id, semester: 'Ganjil', semesterKe: 1 },
    { kurikulumId: kurikulum.id, mataKuliahId: mk2.id, semester: 'Ganjil', semesterKe: 3 }
  ])
  const jadwal = db.createJadwal({
    programStudiId: programStudi.id,
    kurikulumId: kurikulum.id,
    tahunAkademik: '2026/2027',
    semester: 'Ganjil',
    jenisKelas: 'Reguler Pagi'
  })
  return { jadwal, snapshots: db.listJadwalSnapshots(jadwal.id) }
}

function seedJadwalWithTwoSnapshots(db: Persistence): {
  programStudi: { id: number; nama: string }
  kurikulum: { id: number }
  jadwal: { id: number }
  snapshots: Array<{ id: number; kode: string; nama: string; sks: number }>
  dosen: { id: number }
} {
  const programStudi = db.createProgramStudi({ kode: 'IF', nama: 'Informatika' })
  const kurikulum = db.createKurikulum({ programStudiId: programStudi.id, nama: 'Kurikulum 2024' })
  const mk1 = db.createMataKuliah({ kode: 'IF101', nama: 'Algoritma', sks: 3 })
  const mk2 = db.createMataKuliah({ kode: 'IF102', nama: 'Pemrograman', sks: 2 })
  db.addKurikulumMapping({ kurikulumId: kurikulum.id, mataKuliahId: mk1.id, semester: 'Ganjil' })
  db.addKurikulumMapping({ kurikulumId: kurikulum.id, mataKuliahId: mk2.id, semester: 'Ganjil' })
  const dosen = db.createDosen({
    nama: 'Budi',
    gelarDepan: 'Dr.',
    gelarBelakang: 'M.Kom.',
    nidn: '111',
    nuptk: null
  })
  const jadwal = db.createJadwal({
    programStudiId: programStudi.id,
    kurikulumId: kurikulum.id,
    tahunAkademik: '2026/2027',
    semester: 'Ganjil',
    jenisKelas: 'Reguler Pagi'
  })
  return {
    programStudi,
    kurikulum,
    jadwal,
    snapshots: db.listJadwalSnapshots(jadwal.id),
    dosen
  }
}

test('overlapping Kelas on the same Jadwal produce two denormalized Bentrok entries', () => {
  const db = openPersistence(tempDbPath())
  try {
    const { programStudi, jadwal, snapshots, dosen } = seedJadwalWithTwoSnapshots(db)
    const first = db.createKelas({
      jadwalId: jadwal.id,
      snapshotMkId: snapshots[0]!.id,
      dosenId: dosen.id,
      hari: 1,
      jamMulai: 480
    })
    const second = db.createKelas({
      jadwalId: jadwal.id,
      snapshotMkId: snapshots[1]!.id,
      dosenId: dosen.id,
      hari: 1,
      jamMulai: 540
    })
    assert.equal(first.jamSelesai, 630)
    assert.equal(second.jamSelesai, 640)

    const bentrok = db.listBentrok(jadwal.id)
    assert.equal(bentrok.length, 2)
    const byKelas = new Map(bentrok.map((row) => [row.kelasId, row]))
    const firstRow = byKelas.get(first.id)
    const secondRow = byKelas.get(second.id)
    assert.ok(firstRow)
    assert.ok(secondRow)

    assert.equal(firstRow.dosenId, dosen.id)
    assert.equal(firstRow.dosenNama, 'Dr. Budi M.Kom.')
    assert.equal(firstRow.hari, 1)
    assert.equal(firstRow.jamMulai, 480)
    assert.equal(firstRow.jamSelesai, 630)
    assert.equal(firstRow.otherKelasId, second.id)
    assert.equal(firstRow.otherJadwalId, jadwal.id)
    assert.equal(firstRow.otherProgramStudiId, programStudi.id)
    assert.equal(firstRow.otherProgramStudiNama, 'Informatika')
    assert.equal(firstRow.otherJenisKelas, 'Reguler Pagi')
    assert.equal(firstRow.otherMkKode, 'IF102')
    assert.equal(firstRow.otherMkNama, 'Pemrograman')
    assert.equal(firstRow.otherJamMulai, 540)
    assert.equal(firstRow.otherJamSelesai, 640)

    assert.equal(secondRow.dosenNama, 'Dr. Budi M.Kom.')
    assert.equal(secondRow.otherKelasId, first.id)
    assert.equal(secondRow.otherMkKode, 'IF101')
    assert.equal(secondRow.otherMkNama, 'Algoritma')
    assert.equal(secondRow.otherJamMulai, 480)
    assert.equal(secondRow.otherJamSelesai, 630)
  } finally {
    db.close()
  }
})

test('Kelas that only touch at jam selesai are not Bentrok', () => {
  const db = openPersistence(tempDbPath())
  try {
    const { jadwal, snapshots, dosen } = seedJadwalWithTwoSnapshots(db)
    db.createKelas({
      jadwalId: jadwal.id,
      snapshotMkId: snapshots[0]!.id,
      dosenId: dosen.id,
      hari: 1,
      jamMulai: 480
    })
    db.createKelas({
      jadwalId: jadwal.id,
      snapshotMkId: snapshots[1]!.id,
      dosenId: dosen.id,
      hari: 1,
      jamMulai: 630
    })
    assert.deepEqual(db.listBentrok(jadwal.id), [])
  } finally {
    db.close()
  }
})

test('incomplete Kelas are excluded from Bentrok', () => {
  const db = openPersistence(tempDbPath())
  try {
    const { jadwal, snapshots, dosen } = seedJadwalWithTwoSnapshots(db)
    db.createKelas({
      jadwalId: jadwal.id,
      snapshotMkId: snapshots[0]!.id,
      dosenId: dosen.id,
      hari: 1,
      jamMulai: 480
    })
    const incomplete = db.createKelas({
      jadwalId: jadwal.id,
      snapshotMkId: snapshots[1]!.id,
      dosenId: dosen.id,
      hari: 1
    })
    assert.deepEqual(db.listBentrok(jadwal.id), [])

    db.updateKelas(incomplete.id, {
      jadwalId: jadwal.id,
      snapshotMkId: snapshots[1]!.id,
      dosenId: dosen.id,
      jamMulai: 540
    })
    assert.deepEqual(db.listBentrok(jadwal.id), [])

    db.updateKelas(incomplete.id, {
      jadwalId: jadwal.id,
      snapshotMkId: snapshots[1]!.id,
      hari: 1,
      jamMulai: 540
    })
    assert.deepEqual(db.listBentrok(jadwal.id), [])
  } finally {
    db.close()
  }
})

test('overlapping Kelas across Jenis Kelas on the same Tahun Akademik and Semester are Bentrok', () => {
  const db = openPersistence(tempDbPath())
  try {
    const { programStudi, kurikulum, jadwal: pagi, snapshots: pagiSnapshots, dosen } =
      seedJadwalWithTwoSnapshots(db)
    const sore = db.createJadwal({
      programStudiId: programStudi.id,
      kurikulumId: kurikulum.id,
      tahunAkademik: '2026/2027',
      semester: 'Ganjil',
      jenisKelas: 'Reguler Sore'
    })
    const soreSnapshot = db.listJadwalSnapshots(sore.id)[0]!
    const pagiKelas = db.createKelas({
      jadwalId: pagi.id,
      snapshotMkId: pagiSnapshots[0]!.id,
      dosenId: dosen.id,
      hari: 1,
      jamMulai: 960
    })
    const soreKelas = db.createKelas({
      jadwalId: sore.id,
      snapshotMkId: soreSnapshot.id,
      dosenId: dosen.id,
      hari: 1,
      jamMulai: 990
    })
    const bentrok = db.listBentrok(pagi.id)
    assert.equal(bentrok.length, 1)
    assert.equal(bentrok[0]?.kelasId, pagiKelas.id)
    assert.equal(bentrok[0]?.otherKelasId, soreKelas.id)
    assert.equal(bentrok[0]?.otherJadwalId, sore.id)
    assert.equal(bentrok[0]?.otherJenisKelas, 'Reguler Sore')
    assert.equal(bentrok[0]?.otherMkKode, 'IF101')
  } finally {
    db.close()
  }
})

test('overlapping Kelas on another Program Studi in the same Tahun Akademik and Semester are Bentrok', () => {
  const db = openPersistence(tempDbPath())
  try {
    const { jadwal, snapshots, dosen } = seedJadwalWithTwoSnapshots(db)
    const otherProdi = db.createProgramStudi({ kode: 'SI', nama: 'Sistem Informasi' })
    const otherKurikulum = db.createKurikulum({
      programStudiId: otherProdi.id,
      nama: 'Kurikulum SI'
    })
    const otherMk = db.createMataKuliah({ kode: 'SI101', nama: 'Basis Data', sks: 3 })
    db.addKurikulumMapping({
      kurikulumId: otherKurikulum.id,
      mataKuliahId: otherMk.id,
      semester: 'Ganjil'
    })
    const otherJadwal = db.createJadwal({
      programStudiId: otherProdi.id,
      kurikulumId: otherKurikulum.id,
      tahunAkademik: '2026/2027',
      semester: 'Ganjil',
      jenisKelas: 'Reguler Pagi'
    })
    const otherSnapshot = db.listJadwalSnapshots(otherJadwal.id)[0]!
    db.createKelas({
      jadwalId: jadwal.id,
      snapshotMkId: snapshots[0]!.id,
      dosenId: dosen.id,
      hari: 2,
      jamMulai: 480
    })
    const otherKelas = db.createKelas({
      jadwalId: otherJadwal.id,
      snapshotMkId: otherSnapshot.id,
      dosenId: dosen.id,
      hari: 2,
      jamMulai: 500
    })
    const bentrok = db.listBentrok(jadwal.id)
    assert.equal(bentrok.length, 1)
    assert.equal(bentrok[0]?.otherKelasId, otherKelas.id)
    assert.equal(bentrok[0]?.otherJadwalId, otherJadwal.id)
    assert.equal(bentrok[0]?.otherProgramStudiId, otherProdi.id)
    assert.equal(bentrok[0]?.otherProgramStudiNama, 'Sistem Informasi')
    assert.equal(bentrok[0]?.otherMkKode, 'SI101')
    assert.equal(bentrok[0]?.otherMkNama, 'Basis Data')
  } finally {
    db.close()
  }
})

test('Kelas on a different Tahun Akademik or Semester are not Bentrok', () => {
  const db = openPersistence(tempDbPath())
  try {
    const { programStudi, kurikulum, jadwal, snapshots, dosen } = seedJadwalWithTwoSnapshots(db)
    db.addKurikulumMapping({
      kurikulumId: kurikulum.id,
      mataKuliahId: db.createMataKuliah({ kode: 'IF201', nama: 'Struktur Data', sks: 3 }).id,
      semester: 'Genap'
    })
    const otherYear = db.createJadwal({
      programStudiId: programStudi.id,
      kurikulumId: kurikulum.id,
      tahunAkademik: '2025/2026',
      semester: 'Ganjil',
      jenisKelas: 'Reguler Pagi'
    })
    const otherSemester = db.createJadwal({
      programStudiId: programStudi.id,
      kurikulumId: kurikulum.id,
      tahunAkademik: '2026/2027',
      semester: 'Genap',
      jenisKelas: 'Reguler Pagi'
    })
    db.createKelas({
      jadwalId: jadwal.id,
      snapshotMkId: snapshots[0]!.id,
      dosenId: dosen.id,
      hari: 3,
      jamMulai: 480
    })
    db.createKelas({
      jadwalId: otherYear.id,
      snapshotMkId: db.listJadwalSnapshots(otherYear.id)[0]!.id,
      dosenId: dosen.id,
      hari: 3,
      jamMulai: 480
    })
    db.createKelas({
      jadwalId: otherSemester.id,
      snapshotMkId: db.listJadwalSnapshots(otherSemester.id)[0]!.id,
      dosenId: dosen.id,
      hari: 3,
      jamMulai: 480
    })
    assert.deepEqual(db.listBentrok(jadwal.id), [])
  } finally {
    db.close()
  }
})

test('listTahunAkademik returns distinct labels descending', () => {
  const db = openPersistence(tempDbPath())
  try {
    assert.deepEqual(db.listTahunAkademik(), [])
    const { programStudi, kurikulum } = seedJadwalWithTwoSnapshots(db)
    db.createJadwal({
      programStudiId: programStudi.id,
      kurikulumId: kurikulum.id,
      tahunAkademik: '2025/2026',
      semester: 'Ganjil',
      jenisKelas: 'Reguler Sore'
    })
    db.createJadwal({
      programStudiId: programStudi.id,
      kurikulumId: kurikulum.id,
      tahunAkademik: '2026/2027',
      semester: 'Ganjil',
      jenisKelas: 'Reguler Sore'
    })
    assert.deepEqual(db.listTahunAkademik(), ['2026/2027', '2025/2026'])
  } finally {
    db.close()
  }
})

test('listPenugasanDosen lists assigned Kelas across Prodi Semester and Jenis Kelas', () => {
  const db = openPersistence(tempDbPath())
  try {
    const { programStudi, kurikulum, jadwal, snapshots, dosen } = seedJadwalWithTwoSnapshots(db)
    const genapMk = db.createMataKuliah({ kode: 'IF201', nama: 'Struktur Data', sks: 3 })
    db.addKurikulumMapping({
      kurikulumId: kurikulum.id,
      mataKuliahId: genapMk.id,
      semester: 'Genap',
      semesterKe: 2
    })
    const genap = db.createJadwal({
      programStudiId: programStudi.id,
      kurikulumId: kurikulum.id,
      tahunAkademik: '2026/2027',
      semester: 'Genap',
      jenisKelas: 'Reguler Pagi'
    })
    const sore = db.createJadwal({
      programStudiId: programStudi.id,
      kurikulumId: kurikulum.id,
      tahunAkademik: '2026/2027',
      semester: 'Ganjil',
      jenisKelas: 'Reguler Sore'
    })
    const otherProdi = db.createProgramStudi({ kode: 'SI', nama: 'Sistem Informasi' })
    const otherKurikulum = db.createKurikulum({
      programStudiId: otherProdi.id,
      nama: 'Kurikulum SI'
    })
    const otherMk = db.createMataKuliah({ kode: 'SI101', nama: 'Basis Data', sks: 3 })
    db.addKurikulumMapping({
      kurikulumId: otherKurikulum.id,
      mataKuliahId: otherMk.id,
      semester: 'Ganjil',
      semesterKe: 1
    })
    const otherJadwal = db.createJadwal({
      programStudiId: otherProdi.id,
      kurikulumId: otherKurikulum.id,
      tahunAkademik: '2026/2027',
      semester: 'Ganjil',
      jenisKelas: 'Reguler Pagi'
    })
    const otherYear = db.createJadwal({
      programStudiId: programStudi.id,
      kurikulumId: kurikulum.id,
      tahunAkademik: '2025/2026',
      semester: 'Ganjil',
      jenisKelas: 'Reguler Pagi'
    })

    db.createKelas({
      jadwalId: jadwal.id,
      snapshotMkId: snapshots[1]!.id,
      dosenId: dosen.id
    })
    const pagiAssigned = db.createKelas({
      jadwalId: jadwal.id,
      snapshotMkId: snapshots[0]!.id,
      dosenId: dosen.id,
      hari: 1,
      jamMulai: 480
    })
    const soreSnap = db.listJadwalSnapshots(sore.id).find((s) => s.kode === 'IF101')!
    db.createKelas({
      jadwalId: sore.id,
      snapshotMkId: soreSnap.id,
      dosenId: dosen.id,
      hari: 2,
      jamMulai: 960
    })
    const genapSnap = db.listJadwalSnapshots(genap.id).find((s) => s.kode === 'IF201')!
    db.createKelas({
      jadwalId: genap.id,
      snapshotMkId: genapSnap.id,
      dosenId: dosen.id,
      hari: 3,
      jamMulai: 500
    })
    const otherSnap = db.listJadwalSnapshots(otherJadwal.id)[0]!
    db.createKelas({
      jadwalId: otherJadwal.id,
      snapshotMkId: otherSnap.id,
      dosenId: dosen.id,
      hari: 4,
      jamMulai: 480
    })
    db.createKelas({
      jadwalId: otherYear.id,
      snapshotMkId: db.listJadwalSnapshots(otherYear.id)[0]!.id,
      dosenId: dosen.id,
      hari: 1,
      jamMulai: 480
    })

    const rows = db.listPenugasanDosen('2026/2027')
    assert.equal(rows.length, 5)
    assert.deepEqual(
      rows.map((row) => [row.semester, row.programStudiNama, row.jenisKelas, row.kode]),
      [
        ['Ganjil', 'Informatika', 'Reguler Pagi', 'IF101'],
        ['Ganjil', 'Informatika', 'Reguler Pagi', 'IF102'],
        ['Ganjil', 'Informatika', 'Reguler Sore', 'IF101'],
        ['Ganjil', 'Sistem Informasi', 'Reguler Pagi', 'SI101'],
        ['Genap', 'Informatika', 'Reguler Pagi', 'IF201']
      ]
    )
    const pagi = rows.find((row) => row.kelasId === pagiAssigned.id)!
    assert.equal(pagi.dosenNama, 'Dr. Budi M.Kom.')
    assert.equal(pagi.dosenNidn, '111')
    assert.equal(pagi.dosenNuptk, null)
    assert.equal(pagi.nama, 'Algoritma')
    assert.equal(pagi.hari, 1)
    assert.equal(pagi.jamMulai, 480)
    assert.equal(pagi.jamSelesai, 630)
    assert.equal(pagi.jadwalId, jadwal.id)
    assert.equal(pagi.snapshotMkId, snapshots[0]!.id)
    const incomplete = rows.find((row) => row.kode === 'IF102')!
    assert.equal(incomplete.hari, null)
    assert.equal(incomplete.jamMulai, null)
    assert.equal(incomplete.jamSelesai, null)
    assert.equal(genapSnap.semesterKe, 2)
    assert.equal(rows.find((row) => row.kode === 'IF201')?.semesterKe, 2)
    assert.equal(otherSnap.semesterKe, 1)
    assert.equal(rows.find((row) => row.kode === 'SI101')?.semesterKe, 1)
    assert.deepEqual(db.listPenugasanDosen('2099/2100'), [])
    assert.deepEqual(db.listPenugasanDosen('  '), [])
  } finally {
    db.close()
  }
})

test('listPenugasanDosen excludes Kelas without dosen and sorts Semester ke null last', () => {
  const db = openPersistence(tempDbPath())
  try {
    const { programStudi, kurikulum, jadwal, snapshots, dosen } = seedJadwalWithTwoSnapshots(db)
    const mkWithKe = db.createMataKuliah({ kode: 'IF103', nama: 'Diskrit', sks: 2 })
    const mkNoKe = db.createMataKuliah({ kode: 'IF104', nama: 'Etika', sks: 2 })
    db.addKurikulumMapping({
      kurikulumId: kurikulum.id,
      mataKuliahId: mkWithKe.id,
      semester: 'Ganjil',
      semesterKe: 1
    })
    db.addKurikulumMapping({
      kurikulumId: kurikulum.id,
      mataKuliahId: mkNoKe.id,
      semester: 'Ganjil'
    })
    const withKeJadwal = db.createJadwal({
      programStudiId: programStudi.id,
      kurikulumId: kurikulum.id,
      tahunAkademik: '2027/2028',
      semester: 'Ganjil',
      jenisKelas: 'Reguler Pagi'
    })
    const snaps = db.listJadwalSnapshots(withKeJadwal.id)
    const snapKe = snaps.find((s) => s.kode === 'IF103')!
    const snapNull = snaps.find((s) => s.kode === 'IF104')!
    db.createKelas({
      jadwalId: withKeJadwal.id,
      snapshotMkId: snapNull.id,
      dosenId: dosen.id
    })
    db.createKelas({
      jadwalId: withKeJadwal.id,
      snapshotMkId: snapKe.id,
      dosenId: dosen.id
    })
    db.createKelas({
      jadwalId: jadwal.id,
      snapshotMkId: snapshots[0]!.id,
      hari: 1,
      jamMulai: 480
    })
    const rows = db.listPenugasanDosen('2027/2028')
    assert.deepEqual(
      rows.map((row) => [row.kode, row.semesterKe]),
      [
        ['IF103', 1],
        ['IF104', null]
      ]
    )
  } finally {
    db.close()
  }
})
