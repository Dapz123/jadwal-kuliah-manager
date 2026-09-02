import type { ApiError } from './api-error'

export type { ApiError }

export type ProgramStudi = {
  id: number
  kode: string
  nama: string
}

export type ProgramStudiInput = {
  kode: string
  nama: string
}

export type MataKuliah = {
  id: number
  kode: string
  nama: string
  sks: number
}

export type MataKuliahInput = {
  kode: string
  nama: string
  sks: number
}

export type Dosen = {
  id: number
  nama: string
  gelarDepan: string | null
  gelarBelakang: string | null
  nidn: string | null
  nuptk: string | null
}

export type DosenInput = {
  nama: string
  gelarDepan?: string | null
  gelarBelakang?: string | null
  nidn?: string | null
  nuptk?: string | null
}

export type Kurikulum = {
  id: number
  programStudiId: number
  nama: string
}

export type KurikulumInput = {
  programStudiId: number
  nama: string
}

export type Semester = 'Ganjil' | 'Genap'

export type KurikulumMapping = {
  id: number
  kurikulumId: number
  mataKuliahId: number
  semester: Semester
  semesterKe: number | null
}

export type KurikulumMappingInput = {
  kurikulumId: number
  mataKuliahId: number
  semester: Semester
  semesterKe?: number | null
}

export type KurikulumMappingPatch = {
  semester: Semester
  semesterKe?: number | null
}

export type JenisKelas = 'Reguler Pagi' | 'Reguler Sore'

export type Jadwal = {
  id: number
  programStudiId: number
  kurikulumId: number
  tahunAkademik: string
  semester: Semester
  jenisKelas: JenisKelas
}

export type JadwalInput = {
  programStudiId: number
  kurikulumId: number
  tahunAkademik: string
  semester: Semester
  jenisKelas: JenisKelas
}

export type JadwalSnapshot = {
  id: number
  jadwalId: number
  kode: string
  nama: string
  sks: number
  mataKuliahId: number | null
  semesterKe: number | null
}

export type Kelas = {
  id: number
  jadwalId: number
  snapshotMkId: number
  dosenId: number | null
  hari: number | null
  jamMulai: number | null
  jamSelesai: number | null
}

export type KelasInput = {
  jadwalId: number
  snapshotMkId: number
  dosenId?: number | null
  hari?: number | null
  jamMulai?: number | null
}

export type Bentrok = {
  kelasId: number
  dosenId: number
  dosenNama: string
  hari: number
  jamMulai: number
  jamSelesai: number
  otherKelasId: number
  otherJadwalId: number
  otherProgramStudiId: number
  otherProgramStudiNama: string
  otherJenisKelas: JenisKelas
  otherMkKode: string
  otherMkNama: string
  otherJamMulai: number
  otherJamSelesai: number
}

export type BentrokSemesterKe = {
  kelasId: number
  semesterKe: number
  hari: number
  jamMulai: number
  jamSelesai: number
  otherKelasId: number
  otherMkKode: string
  otherMkNama: string
  otherJamMulai: number
  otherJamSelesai: number
}

export type PenugasanDosen = {
  kelasId: number
  jadwalId: number
  snapshotMkId: number
  dosenId: number
  dosenNama: string
  dosenNidn: string | null
  dosenNuptk: string | null
  kode: string
  nama: string
  programStudiNama: string
  semester: Semester
  jenisKelas: JenisKelas
  semesterKe: number | null
  hari: number | null
  jamMulai: number | null
  jamSelesai: number | null
}

export type ExportJadwalXlsxResult =
  | { canceled: true }
  | { path: string; gelarWarnings: string[] }

export type ExportBebanDosenXlsxInput = {
  tahunAkademik: string
  semester: Semester
  jadwalIds: number[]
}

export type ExportBebanDosenXlsxResult = { canceled: true } | { path: string }

export type ExportRekapMkXlsxInput = {
  tahunAkademik: string
  semester: Semester
  jadwalIds: number[]
}

export type ExportRekapMkXlsxResult = { canceled: true } | { path: string }

export type WaktuSks = {
  menit: number
  potonganSoreAktif: boolean
}

export type AppApi = {
  getWaktuSks: () => Promise<WaktuSks>
  updateWaktuSks: (input: WaktuSks) => Promise<void>
  createProgramStudi: (input: ProgramStudiInput) => Promise<ProgramStudi>
  listProgramStudi: () => Promise<ProgramStudi[]>
  updateProgramStudi: (id: number, input: ProgramStudiInput) => Promise<ProgramStudi>
  deleteProgramStudi: (id: number) => Promise<void>
  createMataKuliah: (input: MataKuliahInput) => Promise<MataKuliah>
  listMataKuliah: () => Promise<MataKuliah[]>
  updateMataKuliah: (id: number, input: MataKuliahInput) => Promise<MataKuliah>
  deleteMataKuliah: (id: number) => Promise<void>
  createDosen: (input: DosenInput) => Promise<Dosen>
  listDosen: () => Promise<Dosen[]>
  updateDosen: (id: number, input: DosenInput) => Promise<Dosen>
  deleteDosen: (id: number) => Promise<void>
  createKurikulum: (input: KurikulumInput) => Promise<Kurikulum>
  listKurikulum: (programStudiId: number) => Promise<Kurikulum[]>
  updateKurikulum: (id: number, input: KurikulumInput) => Promise<Kurikulum>
  deleteKurikulum: (id: number) => Promise<void>
  addKurikulumMapping: (input: KurikulumMappingInput) => Promise<KurikulumMapping>
  addKurikulumMappings: (inputs: KurikulumMappingInput[]) => Promise<KurikulumMapping[]>
  listKurikulumMappings: (kurikulumId: number) => Promise<KurikulumMapping[]>
  updateKurikulumMapping: (id: number, input: KurikulumMappingPatch) => Promise<KurikulumMapping>
  removeKurikulumMapping: (id: number) => Promise<void>
  createJadwal: (input: JadwalInput) => Promise<Jadwal>
  listJadwal: (programStudiId: number) => Promise<Jadwal[]>
  getJadwal: (id: number) => Promise<Jadwal>
  deleteJadwal: (id: number) => Promise<void>
  listJadwalSnapshots: (jadwalId: number) => Promise<JadwalSnapshot[]>
  createKelas: (input: KelasInput) => Promise<Kelas>
  listKelas: (jadwalId: number) => Promise<Kelas[]>
  updateKelas: (id: number, input: KelasInput) => Promise<Kelas>
  deleteKelas: (id: number) => Promise<void>
  listBentrok: (jadwalId: number) => Promise<Bentrok[]>
  listBentrokSemesterKe: (jadwalId: number) => Promise<BentrokSemesterKe[]>
  listTahunAkademik: () => Promise<string[]>
  listPenugasanDosen: (tahunAkademik: string) => Promise<PenugasanDosen[]>
  exportJadwalXlsx: (jadwalIds: number[]) => Promise<ExportJadwalXlsxResult>
  exportBebanDosenXlsx: (input: ExportBebanDosenXlsxInput) => Promise<ExportBebanDosenXlsxResult>
  exportRekapMkXlsx: (input: ExportRekapMkXlsxInput) => Promise<ExportRekapMkXlsxResult>
  showItemInFolder: (filePath: string) => Promise<void>
}

export type IpcResult<T> = { ok: true; value: T } | { ok: false; error: ApiError }
