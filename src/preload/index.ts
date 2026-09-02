import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppApi,
  Bentrok,
  BentrokSemesterKe,
  Dosen,
  ExportBebanDosenXlsxInput,
  ExportBebanDosenXlsxResult,
  ExportJadwalXlsxResult,
  ExportRekapMkXlsxInput,
  ExportRekapMkXlsxResult,
  IpcResult,
  Jadwal,
  JadwalSnapshot,
  Kelas,
  Kurikulum,
  KurikulumMapping,
  MataKuliah,
  PenugasanDosen,
  ProgramStudi,
  WaktuSks
} from '../shared/api'
import type { ApiError } from '../shared/api-error'

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as IpcResult<T>
  if (!result.ok) {
    const error: ApiError = result.error
    throw error
  }
  return result.value
}

const api: AppApi = {
  getWaktuSks: () => invoke<WaktuSks>('waktu-sks:get'),
  updateWaktuSks: (input) => invoke<void>('waktu-sks:update', input),
  createProgramStudi: (input) => invoke<ProgramStudi>('program-studi:create', input),
  listProgramStudi: () => invoke<ProgramStudi[]>('program-studi:list'),
  updateProgramStudi: (id, input) => invoke<ProgramStudi>('program-studi:update', id, input),
  deleteProgramStudi: (id) => invoke<void>('program-studi:delete', id),
  createMataKuliah: (input) => invoke<MataKuliah>('mata-kuliah:create', input),
  listMataKuliah: () => invoke<MataKuliah[]>('mata-kuliah:list'),
  updateMataKuliah: (id, input) => invoke<MataKuliah>('mata-kuliah:update', id, input),
  deleteMataKuliah: (id) => invoke<void>('mata-kuliah:delete', id),
  createDosen: (input) => invoke<Dosen>('dosen:create', input),
  listDosen: () => invoke<Dosen[]>('dosen:list'),
  updateDosen: (id, input) => invoke<Dosen>('dosen:update', id, input),
  deleteDosen: (id) => invoke<void>('dosen:delete', id),
  createKurikulum: (input) => invoke<Kurikulum>('kurikulum:create', input),
  listKurikulum: (programStudiId) => invoke<Kurikulum[]>('kurikulum:list', programStudiId),
  updateKurikulum: (id, input) => invoke<Kurikulum>('kurikulum:update', id, input),
  deleteKurikulum: (id) => invoke<void>('kurikulum:delete', id),
  addKurikulumMapping: (input) => invoke<KurikulumMapping>('kurikulum-mapping:add', input),
  addKurikulumMappings: (inputs) =>
    invoke<KurikulumMapping[]>('kurikulum-mapping:add-many', inputs),
  listKurikulumMappings: (kurikulumId) =>
    invoke<KurikulumMapping[]>('kurikulum-mapping:list', kurikulumId),
  updateKurikulumMapping: (id, input) =>
    invoke<KurikulumMapping>('kurikulum-mapping:update', id, input),
  removeKurikulumMapping: (id) => invoke<void>('kurikulum-mapping:remove', id),
  createJadwal: (input) => invoke<Jadwal>('jadwal:create', input),
  listJadwal: (programStudiId) => invoke<Jadwal[]>('jadwal:list', programStudiId),
  getJadwal: (id) => invoke<Jadwal>('jadwal:get', id),
  deleteJadwal: (id) => invoke<void>('jadwal:delete', id),
  listJadwalSnapshots: (jadwalId) => invoke<JadwalSnapshot[]>('jadwal-snapshot:list', jadwalId),
  createKelas: (input) => invoke<Kelas>('kelas:create', input),
  listKelas: (jadwalId) => invoke<Kelas[]>('kelas:list', jadwalId),
  updateKelas: (id, input) => invoke<Kelas>('kelas:update', id, input),
  deleteKelas: (id) => invoke<void>('kelas:delete', id),
  listBentrok: (jadwalId) => invoke<Bentrok[]>('bentrok:list', jadwalId),
  listBentrokSemesterKe: (jadwalId) =>
    invoke<BentrokSemesterKe[]>('bentrok-semester-ke:list', jadwalId),
  listTahunAkademik: () => invoke<string[]>('tahun-akademik:list'),
  listPenugasanDosen: (tahunAkademik) =>
    invoke<PenugasanDosen[]>('penugasan-dosen:list', tahunAkademik),
  exportJadwalXlsx: (jadwalIds) => invoke<ExportJadwalXlsxResult>('jadwal:export-xlsx', jadwalIds),
  exportBebanDosenXlsx: (input: ExportBebanDosenXlsxInput) =>
    invoke<ExportBebanDosenXlsxResult>('beban-dosen:export-xlsx', input),
  exportRekapMkXlsx: (input: ExportRekapMkXlsxInput) =>
    invoke<ExportRekapMkXlsxResult>('rekap-mk:export-xlsx', input),
  showItemInFolder: (filePath) => invoke<void>('shell:show-item-in-folder', filePath)
}

contextBridge.exposeInMainWorld('api', api)
