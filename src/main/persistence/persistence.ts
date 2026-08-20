import Database from 'better-sqlite3'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { apiError, isApiError } from '../../shared/api-error.ts'
import { semesterKeParityOk } from '../../shared/semester-ke.ts'
import type {
  Bentrok,
  BentrokSemesterKe,
  Dosen,
  DosenInput,
  Jadwal,
  JadwalInput,
  JadwalSnapshot,
  JenisKelas,
  Kurikulum,
  KurikulumInput,
  KurikulumMapping,
  KurikulumMappingInput,
  KurikulumMappingPatch,
  Kelas,
  KelasInput,
  MataKuliah,
  PenugasanDosen,
  Semester,
  MataKuliahInput,
  ProgramStudi,
  ProgramStudiInput,
  WaktuSks
} from '../../shared/api.ts'
import { POTONGAN_SORE_MENIT } from '../../shared/waktu-sks.ts'

export type Persistence = {
  getWaktuSks: () => WaktuSks
  updateWaktuSks: (input: WaktuSks) => void
  createProgramStudi: (input: ProgramStudiInput) => ProgramStudi
  listProgramStudi: () => ProgramStudi[]
  updateProgramStudi: (id: number, input: ProgramStudiInput) => ProgramStudi
  deleteProgramStudi: (id: number) => void
  createMataKuliah: (input: MataKuliahInput) => MataKuliah
  listMataKuliah: () => MataKuliah[]
  updateMataKuliah: (id: number, input: MataKuliahInput) => MataKuliah
  deleteMataKuliah: (id: number) => void
  createDosen: (input: DosenInput) => Dosen
  listDosen: () => Dosen[]
  updateDosen: (id: number, input: DosenInput) => Dosen
  deleteDosen: (id: number) => void
  createKurikulum: (input: KurikulumInput) => Kurikulum
  listKurikulum: (programStudiId: number) => Kurikulum[]
  updateKurikulum: (id: number, input: KurikulumInput) => Kurikulum
  deleteKurikulum: (id: number) => void
  addKurikulumMapping: (input: KurikulumMappingInput) => KurikulumMapping
  addKurikulumMappings: (inputs: KurikulumMappingInput[]) => KurikulumMapping[]
  listKurikulumMappings: (kurikulumId: number) => KurikulumMapping[]
  updateKurikulumMapping: (id: number, input: KurikulumMappingPatch) => KurikulumMapping
  removeKurikulumMapping: (id: number) => void
  createJadwal: (input: JadwalInput) => Jadwal
  listJadwal: (programStudiId: number) => Jadwal[]
  getJadwal: (id: number) => Jadwal
  deleteJadwal: (id: number) => void
  listJadwalSnapshots: (jadwalId: number) => JadwalSnapshot[]
  createKelas: (input: KelasInput) => Kelas
  listKelas: (jadwalId: number) => Kelas[]
  updateKelas: (id: number, input: KelasInput) => Kelas
  deleteKelas: (id: number) => void
  listBentrok: (jadwalId: number) => Bentrok[]
  listBentrokSemesterKe: (jadwalId: number) => BentrokSemesterKe[]
  listTahunAkademik: () => string[]
  listPenugasanDosen: (tahunAkademik: string) => PenugasanDosen[]
  close: () => void
}

const MIGRATIONS: string[] = [
  `
  CREATE TABLE waktu_sks (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    menit INTEGER NOT NULL CHECK (menit > 0)
  );
  INSERT INTO waktu_sks (id, menit) VALUES (1, 50);
  `,
  `
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
  `,
  `
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
  `,
  `
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
  `,
  `
  CREATE TABLE kelas (
    id INTEGER PRIMARY KEY,
    jadwal_id INTEGER NOT NULL REFERENCES jadwal(id) ON DELETE CASCADE,
    snapshot_mk_id INTEGER NOT NULL REFERENCES jadwal_snapshot(id) ON DELETE CASCADE,
    dosen_id INTEGER REFERENCES dosen(id),
    hari INTEGER CHECK (hari IS NULL OR (hari >= 1 AND hari <= 7)),
    jam_mulai INTEGER CHECK (jam_mulai IS NULL OR jam_mulai >= 0),
    UNIQUE (jadwal_id, snapshot_mk_id)
  );
  `,
  `
  ALTER TABLE kurikulum_mata_kuliah ADD COLUMN semester_ke INTEGER
    CHECK (
      semester_ke IS NULL OR (
        semester_ke >= 1 AND semester_ke <= 8 AND (
          (semester = 'Ganjil' AND semester_ke % 2 = 1) OR
          (semester = 'Genap' AND semester_ke % 2 = 0)
        )
      )
    );
  ALTER TABLE jadwal_snapshot ADD COLUMN semester_ke INTEGER
    CHECK (semester_ke IS NULL OR (semester_ke >= 1 AND semester_ke <= 8));
  `,
  `
  ALTER TABLE waktu_sks ADD COLUMN potongan_sore INTEGER NOT NULL DEFAULT 1
    CHECK (potongan_sore IN (0, 1));
  `
]

function migrate(db: Database.Database): void {
  const current = db.pragma('user_version', { simple: true }) as number
  for (let version = current; version < MIGRATIONS.length; version++) {
    const sql = MIGRATIONS[version]
    if (!sql) {
      continue
    }
    db.exec(sql)
    db.pragma(`user_version = ${version + 1}`)
  }
}

/** Heal DBs whose user_version skipped past a migration that adds this column. */
function ensurePotonganSoreColumn(db: Database.Database): void {
  const columns = db.prepare('PRAGMA table_info(waktu_sks)').all() as Array<{ name: string }>
  if (columns.some((column) => column.name === 'potongan_sore')) {
    return
  }
  db.exec(`
    ALTER TABLE waktu_sks ADD COLUMN potongan_sore INTEGER NOT NULL DEFAULT 1
      CHECK (potongan_sore IN (0, 1));
  `)
}

function requiredText(value: string, code: string, message: string): string {
  const trimmed = value.trim()
  if (!trimmed) {
    throw apiError(code, message)
  }
  return trimmed
}

function requiredPositiveInt(value: number, code: string, message: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw apiError(code, message)
  }
  return value
}

function mapUniqueConstraint(cause: unknown, code: string, message: string): never {
  if (isApiError(cause)) {
    throw cause
  }
  const err = cause as { code?: string }
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    throw apiError(code, message)
  }
  throw cause
}

function mapForeignKeyConstraint(cause: unknown, code: string, message: string): never {
  if (isApiError(cause)) {
    throw cause
  }
  const err = cause as { code?: string }
  if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    throw apiError(code, message)
  }
  throw cause
}

function parseSemester(value: string, code: string, message: string): Semester {
  if (value === 'Ganjil' || value === 'Genap') {
    return value
  }
  throw apiError(code, message)
}

function parseSemesterKe(value: number | null | undefined): number | null {
  if (value == null) {
    return null
  }
  if (!Number.isInteger(value) || value < 1 || value > 8) {
    throw apiError('KURIKULUM_MAPPING_INVALID', 'Semester ke harus I sampai VIII')
  }
  return value
}

function requireSemesterKeParity(semester: Semester, semesterKe: number | null): void {
  if (semesterKe == null) {
    return
  }
  if (!semesterKeParityOk(semester, semesterKe)) {
    throw apiError(
      'KURIKULUM_MAPPING_INVALID',
      'Semester ke harus ganjil untuk Semester Ganjil, genap untuk Semester Genap'
    )
  }
}

function parseJenisKelas(value: string): JenisKelas {
  if (value === 'Reguler Pagi' || value === 'Reguler Sore') {
    return value
  }
  throw apiError('JADWAL_INVALID', 'Jenis Kelas harus Reguler Pagi atau Reguler Sore')
}

function optionalHari(value: number | null | undefined): number | null {
  if (value == null) {
    return null
  }
  if (!Number.isInteger(value) || value < 1 || value > 7) {
    throw apiError('KELAS_INVALID', 'Hari harus bilangan 1 sampai 7')
  }
  return value
}

function optionalJamMulai(value: number | null | undefined): number | null {
  if (value == null) {
    return null
  }
  if (!Number.isInteger(value) || value < 0) {
    throw apiError(
      'KELAS_INVALID',
      'Jam mulai harus menit dari tengah malam (bilangan bulat tidak negatif)'
    )
  }
  return value
}

function optionalText(value: string | null | undefined): string | null {
  if (value == null) {
    return null
  }
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const DOSEN_SELECT =
  'SELECT id, nama, gelar_depan AS gelarDepan, gelar_belakang AS gelarBelakang, nidn, nuptk FROM dosen'

const KURIKULUM_SELECT =
  'SELECT id, program_studi_id AS programStudiId, nama FROM kurikulum'

const KURIKULUM_MAPPING_SELECT = `SELECT id, kurikulum_id AS kurikulumId, mata_kuliah_id AS mataKuliahId, semester,
  semester_ke AS semesterKe
  FROM kurikulum_mata_kuliah`

const JADWAL_SELECT = `SELECT id, program_studi_id AS programStudiId, kurikulum_id AS kurikulumId,
  tahun_akademik AS tahunAkademik, semester, jenis_kelas AS jenisKelas FROM jadwal`

const JADWAL_SNAPSHOT_SELECT = `SELECT id, jadwal_id AS jadwalId, kode, nama, sks, mata_kuliah_id AS mataKuliahId,
  semester_ke AS semesterKe
  FROM jadwal_snapshot`

// ponytail: mirrors menitPerSks() in shared/waktu-sks.ts — keep in sync
function menitPerSksSql(jenisKelasExpr: string): string {
  return `CASE
    WHEN w.potongan_sore = 1 AND ${jenisKelasExpr} = 'Reguler Sore' THEN w.menit - ${POTONGAN_SORE_MENIT}
    ELSE w.menit
  END`
}

const KELAS_SELECT = `SELECT k.id, k.jadwal_id AS jadwalId, k.snapshot_mk_id AS snapshotMkId,
  k.dosen_id AS dosenId, k.hari, k.jam_mulai AS jamMulai,
  CASE WHEN k.jam_mulai IS NULL THEN NULL
    ELSE k.jam_mulai + (s.sks * (${menitPerSksSql('j.jenis_kelas')}))
  END AS jamSelesai
  FROM kelas k
  JOIN jadwal j ON j.id = k.jadwal_id
  JOIN jadwal_snapshot s ON s.id = k.snapshot_mk_id
  JOIN waktu_sks w ON w.id = 1`

function parseDosenFields(input: DosenInput): {
  nama: string
  gelarDepan: string | null
  gelarBelakang: string | null
  nidn: string | null
  nuptk: string | null
} {
  const nama = requiredText(input.nama, 'DOSEN_INVALID', 'Nama Dosen wajib diisi')
  const nidn = optionalText(input.nidn)
  const nuptk = optionalText(input.nuptk)
  if (!nidn && !nuptk) {
    throw apiError('DOSEN_INVALID', 'Dosen wajib memiliki NIDN atau NUPTK')
  }
  return {
    nama,
    gelarDepan: optionalText(input.gelarDepan),
    gelarBelakang: optionalText(input.gelarBelakang),
    nidn,
    nuptk
  }
}

function mapDosenUnique(cause: unknown): never {
  if (isApiError(cause)) {
    throw cause
  }
  const err = cause as { code?: string; message?: string }
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    const text = String(err.message)
    // ponytail: SQLite reports partial-index uniqueness as "dosen.nidn" / "dosen.nuptk"
    // in the message; upgrade if better-sqlite3 exposes the constraint name as a field.
    if (text.includes('dosen.nidn')) {
      throw apiError('DOSEN_NIDN_DUPLICATE', 'NIDN sudah digunakan')
    }
    if (text.includes('dosen.nuptk')) {
      throw apiError('DOSEN_NUPTK_DUPLICATE', 'NUPTK sudah digunakan')
    }
  }
  throw cause
}

function refuseUnwritable(dbPath: string, cause: unknown): never {
  const osMessage = cause instanceof Error ? cause.message : String(cause)
  throw apiError(
    'DB_PATH_UNWRITABLE',
    `Lokasi database tidak dapat ditulis: ${dbPath} (${osMessage})`
  )
}

export function openPersistence(dbPath: string): Persistence {
  try {
    mkdirSync(dirname(dbPath), { recursive: true })
  } catch (cause) {
    refuseUnwritable(dbPath, cause)
  }

  let db: Database.Database
  try {
    db = new Database(dbPath)
  } catch (cause) {
    refuseUnwritable(dbPath, cause)
  }

  db.pragma('foreign_keys = ON')
  migrate(db)
  ensurePotonganSoreColumn(db)

  function getMataKuliah(id: number): MataKuliah {
    const row = db.prepare('SELECT id, kode, nama, sks FROM mata_kuliah WHERE id = ?').get(id) as
      MataKuliah | undefined
    if (!row) {
      throw apiError('MATA_KULIAH_NOT_FOUND', 'Mata Kuliah tidak ditemukan')
    }
    return row
  }

  function getDosen(id: number): Dosen {
    const row = db.prepare(`${DOSEN_SELECT} WHERE id = ?`).get(id) as Dosen | undefined
    if (!row) {
      throw apiError('DOSEN_NOT_FOUND', 'Dosen tidak ditemukan')
    }
    return row
  }

  function getKurikulum(id: number): Kurikulum {
    const row = db.prepare(`${KURIKULUM_SELECT} WHERE id = ?`).get(id) as Kurikulum | undefined
    if (!row) {
      throw apiError('KURIKULUM_NOT_FOUND', 'Kurikulum tidak ditemukan')
    }
    return row
  }

  function requireProgramStudi(id: number): void {
    const exists = db.prepare('SELECT id FROM program_studi WHERE id = ?').get(id)
    if (!exists) {
      throw apiError('PROGRAM_STUDI_NOT_FOUND', 'Program Studi tidak ditemukan')
    }
  }

  function getKurikulumMapping(id: number): KurikulumMapping {
    const row = db.prepare(`${KURIKULUM_MAPPING_SELECT} WHERE id = ?`).get(id) as
      | KurikulumMapping
      | undefined
    if (!row) {
      throw apiError('KURIKULUM_MAPPING_NOT_FOUND', 'Pemetaan Kurikulum tidak ditemukan')
    }
    return row
  }

  function addMapping(input: KurikulumMappingInput): KurikulumMapping {
    getKurikulum(input.kurikulumId)
    getMataKuliah(input.mataKuliahId)
    const semester = parseSemester(
      input.semester,
      'KURIKULUM_MAPPING_INVALID',
      'Semester harus Ganjil atau Genap'
    )
    const semesterKe = parseSemesterKe(input.semesterKe)
    requireSemesterKeParity(semester, semesterKe)
    try {
      const result = db
        .prepare(
          `INSERT INTO kurikulum_mata_kuliah (kurikulum_id, mata_kuliah_id, semester, semester_ke)
           VALUES (?, ?, ?, ?)`
        )
        .run(input.kurikulumId, input.mataKuliahId, semester, semesterKe)
      return getKurikulumMapping(result.lastInsertRowid as number)
    } catch (cause) {
      mapUniqueConstraint(
        cause,
        'KURIKULUM_MAPPING_DUPLICATE',
        'Mata Kuliah sudah dipetakan pada Kurikulum ini'
      )
    }
  }

  function getJadwal(id: number): Jadwal {
    const row = db.prepare(`${JADWAL_SELECT} WHERE id = ?`).get(id) as Jadwal | undefined
    if (!row) {
      throw apiError('JADWAL_NOT_FOUND', 'Jadwal tidak ditemukan')
    }
    return row
  }

  function getKelas(id: number): Kelas {
    const row = db.prepare(`${KELAS_SELECT} WHERE k.id = ?`).get(id) as Kelas | undefined
    if (!row) {
      throw apiError('KELAS_NOT_FOUND', 'Kelas tidak ditemukan')
    }
    return row
  }

  function parseKelasInput(input: KelasInput): {
    jadwalId: number
    snapshotMkId: number
    dosenId: number | null
    hari: number | null
    jamMulai: number | null
  } {
    getJadwal(input.jadwalId)
    const snapshot = db
      .prepare(`${JADWAL_SNAPSHOT_SELECT} WHERE id = ?`)
      .get(input.snapshotMkId) as JadwalSnapshot | undefined
    if (!snapshot) {
      throw apiError('KELAS_SNAPSHOT_NOT_FOUND', 'Snapshot Mata Kuliah tidak ditemukan')
    }
    if (snapshot.jadwalId !== input.jadwalId) {
      throw apiError(
        'KELAS_SNAPSHOT_MISMATCH',
        'Snapshot Mata Kuliah tidak milik Jadwal yang dipilih'
      )
    }
    const dosenId = input.dosenId ?? null
    if (dosenId != null) {
      getDosen(dosenId)
    }
    return {
      jadwalId: input.jadwalId,
      snapshotMkId: input.snapshotMkId,
      dosenId,
      hari: optionalHari(input.hari),
      jamMulai: optionalJamMulai(input.jamMulai)
    }
  }

  return {
    getWaktuSks(): WaktuSks {
      const row = db
        .prepare('SELECT menit, potongan_sore AS potonganSore FROM waktu_sks WHERE id = 1')
        .get() as { menit: number; potonganSore: number } | undefined
      if (!row) {
        throw apiError('WAKTU_SKS_MISSING', 'Waktu SKS belum diinisialisasi')
      }
      return { menit: row.menit, potonganSoreAktif: row.potonganSore === 1 }
    },
    updateWaktuSks(input: WaktuSks): void {
      const menit = input.menit
      if (!Number.isInteger(menit) || menit <= 0) {
        throw apiError('WAKTU_SKS_INVALID', 'Waktu SKS harus bilangan bulat positif (menit)')
      }
      if (typeof input.potonganSoreAktif !== 'boolean') {
        throw apiError('WAKTU_SKS_INVALID', 'Potongan Sore harus true atau false')
      }
      if (input.potonganSoreAktif && menit <= POTONGAN_SORE_MENIT) {
        throw apiError(
          'WAKTU_SKS_INVALID',
          `Waktu SKS harus lebih dari ${POTONGAN_SORE_MENIT} menit saat Potongan Sore aktif`
        )
      }
      db.prepare('UPDATE waktu_sks SET menit = ?, potongan_sore = ? WHERE id = 1').run(
        menit,
        input.potonganSoreAktif ? 1 : 0
      )
    },
    createProgramStudi(input: ProgramStudiInput): ProgramStudi {
      const kode = requiredText(
        input.kode,
        'PROGRAM_STUDI_INVALID',
        'Kode Program Studi wajib diisi'
      )
      const nama = requiredText(
        input.nama,
        'PROGRAM_STUDI_INVALID',
        'Nama Program Studi wajib diisi'
      )
      try {
        const result = db
          .prepare('INSERT INTO program_studi (kode, nama) VALUES (?, ?)')
          .run(kode, nama)
        return db
          .prepare('SELECT id, kode, nama FROM program_studi WHERE id = ?')
          .get(result.lastInsertRowid) as ProgramStudi
      } catch (cause) {
        mapUniqueConstraint(
          cause,
          'PROGRAM_STUDI_KODE_DUPLICATE',
          'Kode Program Studi sudah digunakan'
        )
      }
    },
    listProgramStudi(): ProgramStudi[] {
      return db
        .prepare('SELECT id, kode, nama FROM program_studi ORDER BY id')
        .all() as ProgramStudi[]
    },
    updateProgramStudi(id: number, input: ProgramStudiInput): ProgramStudi {
      const kode = requiredText(
        input.kode,
        'PROGRAM_STUDI_INVALID',
        'Kode Program Studi wajib diisi'
      )
      const nama = requiredText(
        input.nama,
        'PROGRAM_STUDI_INVALID',
        'Nama Program Studi wajib diisi'
      )
      try {
        const result = db
          .prepare('UPDATE program_studi SET kode = ?, nama = ? WHERE id = ?')
          .run(kode, nama, id)
        if (result.changes === 0) {
          throw apiError('PROGRAM_STUDI_NOT_FOUND', 'Program Studi tidak ditemukan')
        }
        return db
          .prepare('SELECT id, kode, nama FROM program_studi WHERE id = ?')
          .get(id) as ProgramStudi
      } catch (cause) {
        mapUniqueConstraint(
          cause,
          'PROGRAM_STUDI_KODE_DUPLICATE',
          'Kode Program Studi sudah digunakan'
        )
      }
    },
    deleteProgramStudi(id: number): void {
      try {
        const result = db.prepare('DELETE FROM program_studi WHERE id = ?').run(id)
        if (result.changes === 0) {
          throw apiError('PROGRAM_STUDI_NOT_FOUND', 'Program Studi tidak ditemukan')
        }
      } catch (cause) {
        mapForeignKeyConstraint(
          cause,
          'PROGRAM_STUDI_HAS_KURIKULUM',
          'Program Studi masih memiliki Kurikulum'
        )
      }
    },
    createMataKuliah(input: MataKuliahInput): MataKuliah {
      const kode = requiredText(input.kode, 'MATA_KULIAH_INVALID', 'Kode Mata Kuliah wajib diisi')
      const nama = requiredText(input.nama, 'MATA_KULIAH_INVALID', 'Nama Mata Kuliah wajib diisi')
      const sks = requiredPositiveInt(
        input.sks,
        'MATA_KULIAH_INVALID',
        'SKS harus bilangan bulat positif'
      )
      try {
        const result = db
          .prepare('INSERT INTO mata_kuliah (kode, nama, sks) VALUES (?, ?, ?)')
          .run(kode, nama, sks)
        return getMataKuliah(result.lastInsertRowid as number)
      } catch (cause) {
        mapUniqueConstraint(cause, 'MATA_KULIAH_KODE_DUPLICATE', 'Kode Mata Kuliah sudah digunakan')
      }
    },
    listMataKuliah(): MataKuliah[] {
      return db
        .prepare('SELECT id, kode, nama, sks FROM mata_kuliah ORDER BY id')
        .all() as MataKuliah[]
    },
    updateMataKuliah(id: number, input: MataKuliahInput): MataKuliah {
      const kode = requiredText(input.kode, 'MATA_KULIAH_INVALID', 'Kode Mata Kuliah wajib diisi')
      const nama = requiredText(input.nama, 'MATA_KULIAH_INVALID', 'Nama Mata Kuliah wajib diisi')
      const sks = requiredPositiveInt(
        input.sks,
        'MATA_KULIAH_INVALID',
        'SKS harus bilangan bulat positif'
      )
      try {
        const result = db
          .prepare('UPDATE mata_kuliah SET kode = ?, nama = ?, sks = ? WHERE id = ?')
          .run(kode, nama, sks, id)
        if (result.changes === 0) {
          throw apiError('MATA_KULIAH_NOT_FOUND', 'Mata Kuliah tidak ditemukan')
        }
        return getMataKuliah(id)
      } catch (cause) {
        mapUniqueConstraint(cause, 'MATA_KULIAH_KODE_DUPLICATE', 'Kode Mata Kuliah sudah digunakan')
      }
    },
    deleteMataKuliah(id: number): void {
      try {
        const result = db.prepare('DELETE FROM mata_kuliah WHERE id = ?').run(id)
        if (result.changes === 0) {
          throw apiError('MATA_KULIAH_NOT_FOUND', 'Mata Kuliah tidak ditemukan')
        }
      } catch (cause) {
        mapForeignKeyConstraint(
          cause,
          'MATA_KULIAH_IN_KURIKULUM',
          'Mata Kuliah masih terpetakan pada Kurikulum'
        )
      }
    },
    createDosen(input: DosenInput): Dosen {
      const fields = parseDosenFields(input)
      try {
        const result = db
          .prepare(
            'INSERT INTO dosen (nama, gelar_depan, gelar_belakang, nidn, nuptk) VALUES (?, ?, ?, ?, ?)'
          )
          .run(fields.nama, fields.gelarDepan, fields.gelarBelakang, fields.nidn, fields.nuptk)
        return getDosen(result.lastInsertRowid as number)
      } catch (cause) {
        mapDosenUnique(cause)
      }
    },
    listDosen(): Dosen[] {
      return db.prepare(`${DOSEN_SELECT} ORDER BY id`).all() as Dosen[]
    },
    updateDosen(id: number, input: DosenInput): Dosen {
      const fields = parseDosenFields(input)
      try {
        const result = db
          .prepare(
            'UPDATE dosen SET nama = ?, gelar_depan = ?, gelar_belakang = ?, nidn = ?, nuptk = ? WHERE id = ?'
          )
          .run(fields.nama, fields.gelarDepan, fields.gelarBelakang, fields.nidn, fields.nuptk, id)
        if (result.changes === 0) {
          throw apiError('DOSEN_NOT_FOUND', 'Dosen tidak ditemukan')
        }
        return getDosen(id)
      } catch (cause) {
        mapDosenUnique(cause)
      }
    },
    deleteDosen(id: number): void {
      try {
        const result = db.prepare('DELETE FROM dosen WHERE id = ?').run(id)
        if (result.changes === 0) {
          throw apiError('DOSEN_NOT_FOUND', 'Dosen tidak ditemukan')
        }
      } catch (cause) {
        mapForeignKeyConstraint(cause, 'DOSEN_HAS_KELAS', 'Dosen masih ditugaskan pada Kelas')
      }
    },
    createKurikulum(input: KurikulumInput): Kurikulum {
      const nama = requiredText(input.nama, 'KURIKULUM_INVALID', 'Nama Kurikulum wajib diisi')
      requireProgramStudi(input.programStudiId)
      try {
        const result = db
          .prepare('INSERT INTO kurikulum (program_studi_id, nama) VALUES (?, ?)')
          .run(input.programStudiId, nama)
        return getKurikulum(result.lastInsertRowid as number)
      } catch (cause) {
        mapUniqueConstraint(
          cause,
          'KURIKULUM_NAMA_DUPLICATE',
          'Nama Kurikulum sudah digunakan pada Program Studi ini'
        )
      }
    },
    listKurikulum(programStudiId: number): Kurikulum[] {
      return db
        .prepare(`${KURIKULUM_SELECT} WHERE program_studi_id = ? ORDER BY id`)
        .all(programStudiId) as Kurikulum[]
    },
    updateKurikulum(id: number, input: KurikulumInput): Kurikulum {
      const nama = requiredText(input.nama, 'KURIKULUM_INVALID', 'Nama Kurikulum wajib diisi')
      try {
        const result = db.prepare('UPDATE kurikulum SET nama = ? WHERE id = ?').run(nama, id)
        if (result.changes === 0) {
          throw apiError('KURIKULUM_NOT_FOUND', 'Kurikulum tidak ditemukan')
        }
        return getKurikulum(id)
      } catch (cause) {
        mapUniqueConstraint(
          cause,
          'KURIKULUM_NAMA_DUPLICATE',
          'Nama Kurikulum sudah digunakan pada Program Studi ini'
        )
      }
    },
    deleteKurikulum(id: number): void {
      try {
        const result = db.prepare('DELETE FROM kurikulum WHERE id = ?').run(id)
        if (result.changes === 0) {
          throw apiError('KURIKULUM_NOT_FOUND', 'Kurikulum tidak ditemukan')
        }
      } catch (cause) {
        mapForeignKeyConstraint(
          cause,
          'KURIKULUM_HAS_JADWAL',
          'Kurikulum masih digunakan oleh Jadwal'
        )
      }
    },
    addKurikulumMapping(input: KurikulumMappingInput): KurikulumMapping {
      return addMapping(input)
    },
    addKurikulumMappings(inputs: KurikulumMappingInput[]): KurikulumMapping[] {
      return db.transaction(() => inputs.map(addMapping))()
    },
    listKurikulumMappings(kurikulumId: number): KurikulumMapping[] {
      return db
        .prepare(`${KURIKULUM_MAPPING_SELECT} WHERE kurikulum_id = ? ORDER BY id`)
        .all(kurikulumId) as KurikulumMapping[]
    },
    updateKurikulumMapping(id: number, input: KurikulumMappingPatch): KurikulumMapping {
      getKurikulumMapping(id)
      const semester = parseSemester(
        input.semester,
        'KURIKULUM_MAPPING_INVALID',
        'Semester harus Ganjil atau Genap'
      )
      const semesterKe = parseSemesterKe(input.semesterKe)
      requireSemesterKeParity(semester, semesterKe)
      db.prepare('UPDATE kurikulum_mata_kuliah SET semester = ?, semester_ke = ? WHERE id = ?').run(
        semester,
        semesterKe,
        id
      )
      return getKurikulumMapping(id)
    },
    removeKurikulumMapping(id: number): void {
      const result = db.prepare('DELETE FROM kurikulum_mata_kuliah WHERE id = ?').run(id)
      if (result.changes === 0) {
        throw apiError('KURIKULUM_MAPPING_NOT_FOUND', 'Pemetaan Kurikulum tidak ditemukan')
      }
    },
    createJadwal(input: JadwalInput): Jadwal {
      const tahunAkademik = requiredText(
        input.tahunAkademik,
        'JADWAL_INVALID',
        'Tahun Akademik wajib diisi'
      )
      const semester = parseSemester(
        input.semester,
        'JADWAL_INVALID',
        'Semester harus Ganjil atau Genap'
      )
      const jenisKelas = parseJenisKelas(input.jenisKelas)
      requireProgramStudi(input.programStudiId)
      const kurikulum = getKurikulum(input.kurikulumId)
      if (kurikulum.programStudiId !== input.programStudiId) {
        throw apiError(
          'JADWAL_KURIKULUM_MISMATCH',
          'Kurikulum tidak milik Program Studi yang dipilih'
        )
      }
      const mappings = db
        .prepare(
          `${KURIKULUM_MAPPING_SELECT} WHERE kurikulum_id = ? AND semester = ? ORDER BY id`
        )
        .all(input.kurikulumId, semester) as KurikulumMapping[]
      if (mappings.length === 0) {
        throw apiError(
          'JADWAL_SNAPSHOT_EMPTY',
          'Kurikulum tidak memiliki Mata Kuliah untuk semester ini'
        )
      }
      const insertJadwal = db.prepare(
        `INSERT INTO jadwal (program_studi_id, kurikulum_id, tahun_akademik, semester, jenis_kelas)
         VALUES (?, ?, ?, ?, ?)`
      )
      const insertSnapshot = db.prepare(
        `INSERT INTO jadwal_snapshot (jadwal_id, kode, nama, sks, mata_kuliah_id, semester_ke)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      const create = db.transaction(() => {
        try {
          const result = insertJadwal.run(
            input.programStudiId,
            input.kurikulumId,
            tahunAkademik,
            semester,
            jenisKelas
          )
          const jadwalId = result.lastInsertRowid as number
          for (const mapping of mappings) {
            const mataKuliah = getMataKuliah(mapping.mataKuliahId)
            insertSnapshot.run(
              jadwalId,
              mataKuliah.kode,
              mataKuliah.nama,
              mataKuliah.sks,
              mataKuliah.id,
              mapping.semesterKe
            )
          }
          return getJadwal(jadwalId)
        } catch (cause) {
          mapUniqueConstraint(
            cause,
            'JADWAL_DUPLICATE',
            'Jadwal untuk Program Studi, Tahun Akademik, Semester, dan Jenis Kelas ini sudah ada'
          )
        }
      })
      return create()
    },
    listJadwal(programStudiId: number): Jadwal[] {
      return db
        .prepare(`${JADWAL_SELECT} WHERE program_studi_id = ? ORDER BY id`)
        .all(programStudiId) as Jadwal[]
    },
    getJadwal(id: number): Jadwal {
      return getJadwal(id)
    },
    deleteJadwal(id: number): void {
      const result = db.prepare('DELETE FROM jadwal WHERE id = ?').run(id)
      if (result.changes === 0) {
        throw apiError('JADWAL_NOT_FOUND', 'Jadwal tidak ditemukan')
      }
    },
    listJadwalSnapshots(jadwalId: number): JadwalSnapshot[] {
      return db
        .prepare(`${JADWAL_SNAPSHOT_SELECT} WHERE jadwal_id = ? ORDER BY id`)
        .all(jadwalId) as JadwalSnapshot[]
    },
    createKelas(input: KelasInput): Kelas {
      const fields = parseKelasInput(input)
      try {
        const result = db
          .prepare(
            'INSERT INTO kelas (jadwal_id, snapshot_mk_id, dosen_id, hari, jam_mulai) VALUES (?, ?, ?, ?, ?)'
          )
          .run(fields.jadwalId, fields.snapshotMkId, fields.dosenId, fields.hari, fields.jamMulai)
        return getKelas(result.lastInsertRowid as number)
      } catch (cause) {
        mapUniqueConstraint(
          cause,
          'KELAS_DUPLICATE',
          'Kelas untuk Mata Kuliah ini pada Jadwal sudah ada'
        )
      }
    },
    listKelas(jadwalId: number): Kelas[] {
      return db
        .prepare(`${KELAS_SELECT} WHERE k.jadwal_id = ? ORDER BY k.id`)
        .all(jadwalId) as Kelas[]
    },
    updateKelas(id: number, input: KelasInput): Kelas {
      getKelas(id)
      const dosenId = input.dosenId ?? null
      if (dosenId != null) {
        getDosen(dosenId)
      }
      db.prepare('UPDATE kelas SET dosen_id = ?, hari = ?, jam_mulai = ? WHERE id = ?').run(
        dosenId,
        optionalHari(input.hari),
        optionalJamMulai(input.jamMulai),
        id
      )
      return getKelas(id)
    },
    deleteKelas(id: number): void {
      const result = db.prepare('DELETE FROM kelas WHERE id = ?').run(id)
      if (result.changes === 0) {
        throw apiError('KELAS_NOT_FOUND', 'Kelas tidak ditemukan')
      }
    },
    listBentrok(jadwalId: number): Bentrok[] {
      getJadwal(jadwalId)
      return db
        .prepare(
          `SELECT
            mine.id AS kelasId,
            mine.dosen_id AS dosenId,
            TRIM(
              COALESCE(d.gelar_depan || ' ', '') || d.nama || COALESCE(' ' || d.gelar_belakang, '')
            ) AS dosenNama,
            mine.hari AS hari,
            mine.jam_mulai AS jamMulai,
            mine.jam_mulai + (mine_snap.sks * (${menitPerSksSql('mine_j.jenis_kelas')})) AS jamSelesai,
            other.id AS otherKelasId,
            other.jadwal_id AS otherJadwalId,
            other_j.program_studi_id AS otherProgramStudiId,
            other_ps.nama AS otherProgramStudiNama,
            other_j.jenis_kelas AS otherJenisKelas,
            other_snap.kode AS otherMkKode,
            other_snap.nama AS otherMkNama,
            other.jam_mulai AS otherJamMulai,
            other.jam_mulai + (other_snap.sks * (${menitPerSksSql('other_j.jenis_kelas')})) AS otherJamSelesai
          FROM kelas mine
          JOIN jadwal mine_j ON mine_j.id = mine.jadwal_id
          JOIN jadwal_snapshot mine_snap ON mine_snap.id = mine.snapshot_mk_id
          JOIN dosen d ON d.id = mine.dosen_id
          JOIN waktu_sks w ON w.id = 1
          JOIN kelas other ON other.id != mine.id
          JOIN jadwal other_j ON other_j.id = other.jadwal_id
            AND other_j.tahun_akademik = mine_j.tahun_akademik
            AND other_j.semester = mine_j.semester
          JOIN jadwal_snapshot other_snap ON other_snap.id = other.snapshot_mk_id
          JOIN program_studi other_ps ON other_ps.id = other_j.program_studi_id
          WHERE mine.jadwal_id = ?
            AND mine.hari IS NOT NULL
            AND mine.jam_mulai IS NOT NULL
            AND other.dosen_id IS NOT NULL
            AND other.hari IS NOT NULL
            AND other.jam_mulai IS NOT NULL
            AND mine.dosen_id = other.dosen_id
            AND mine.hari = other.hari
            AND mine.jam_mulai < other.jam_mulai + (other_snap.sks * (${menitPerSksSql('other_j.jenis_kelas')}))
            AND other.jam_mulai < mine.jam_mulai + (mine_snap.sks * (${menitPerSksSql('mine_j.jenis_kelas')}))
          ORDER BY mine.id, other.id`
        )
        .all(jadwalId) as Bentrok[]
    },
    listBentrokSemesterKe(jadwalId: number): BentrokSemesterKe[] {
      getJadwal(jadwalId)
      return db
        .prepare(
          `SELECT
            mine.id AS kelasId,
            mine_snap.semester_ke AS semesterKe,
            mine.hari AS hari,
            mine.jam_mulai AS jamMulai,
            mine.jam_mulai + (mine_snap.sks * (${menitPerSksSql('j.jenis_kelas')})) AS jamSelesai,
            other.id AS otherKelasId,
            other_snap.kode AS otherMkKode,
            other_snap.nama AS otherMkNama,
            other.jam_mulai AS otherJamMulai,
            other.jam_mulai + (other_snap.sks * (${menitPerSksSql('j.jenis_kelas')})) AS otherJamSelesai
          FROM kelas mine
          JOIN jadwal j ON j.id = mine.jadwal_id
          JOIN jadwal_snapshot mine_snap ON mine_snap.id = mine.snapshot_mk_id
          JOIN waktu_sks w ON w.id = 1
          JOIN kelas other ON other.id != mine.id AND other.jadwal_id = mine.jadwal_id
          JOIN jadwal_snapshot other_snap ON other_snap.id = other.snapshot_mk_id
          WHERE mine.jadwal_id = ?
            AND mine.hari IS NOT NULL
            AND mine.jam_mulai IS NOT NULL
            AND other.hari IS NOT NULL
            AND other.jam_mulai IS NOT NULL
            AND mine_snap.semester_ke IS NOT NULL
            AND other_snap.semester_ke IS NOT NULL
            AND mine_snap.semester_ke = other_snap.semester_ke
            AND mine.hari = other.hari
            AND mine.jam_mulai < other.jam_mulai + (other_snap.sks * (${menitPerSksSql('j.jenis_kelas')}))
            AND other.jam_mulai < mine.jam_mulai + (mine_snap.sks * (${menitPerSksSql('j.jenis_kelas')}))
          ORDER BY mine.id, other.id`
        )
        .all(jadwalId) as BentrokSemesterKe[]
    },
    listTahunAkademik(): string[] {
      return (
        db
          .prepare(
            `SELECT DISTINCT tahun_akademik AS tahunAkademik
             FROM jadwal
             ORDER BY tahun_akademik DESC`
          )
          .all() as Array<{ tahunAkademik: string }>
      ).map((row) => row.tahunAkademik)
    },
    listPenugasanDosen(tahunAkademik: string): PenugasanDosen[] {
      const tahun = tahunAkademik.trim()
      if (!tahun) {
        return []
      }
      return db
        .prepare(
          `SELECT
            k.id AS kelasId,
            k.jadwal_id AS jadwalId,
            k.snapshot_mk_id AS snapshotMkId,
            k.dosen_id AS dosenId,
            TRIM(
              COALESCE(d.gelar_depan || ' ', '') || d.nama || COALESCE(' ' || d.gelar_belakang, '')
            ) AS dosenNama,
            d.nidn AS dosenNidn,
            d.nuptk AS dosenNuptk,
            s.kode AS kode,
            s.nama AS nama,
            ps.nama AS programStudiNama,
            j.semester AS semester,
            j.jenis_kelas AS jenisKelas,
            s.semester_ke AS semesterKe,
            k.hari AS hari,
            k.jam_mulai AS jamMulai,
            CASE WHEN k.jam_mulai IS NULL THEN NULL
              ELSE k.jam_mulai + (s.sks * (${menitPerSksSql('j.jenis_kelas')}))
            END AS jamSelesai
          FROM kelas k
          JOIN jadwal j ON j.id = k.jadwal_id
          JOIN jadwal_snapshot s ON s.id = k.snapshot_mk_id
          JOIN dosen d ON d.id = k.dosen_id
          JOIN program_studi ps ON ps.id = j.program_studi_id
          JOIN waktu_sks w ON w.id = 1
          WHERE j.tahun_akademik = ?
            AND k.dosen_id IS NOT NULL
          ORDER BY
            CASE j.semester WHEN 'Ganjil' THEN 0 ELSE 1 END,
            ps.nama,
            CASE j.jenis_kelas WHEN 'Reguler Pagi' THEN 0 ELSE 1 END,
            s.kode,
            s.semester_ke IS NULL,
            s.semester_ke`
        )
        .all(tahun) as PenugasanDosen[]
    },
    close(): void {
      db.close()
    }
  }
}
