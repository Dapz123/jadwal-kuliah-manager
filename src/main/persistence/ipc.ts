import { ipcMain } from 'electron'
import { isApiError, type ApiError } from '../../shared/api-error'
import type {
  Bentrok,
  BentrokSemesterKe,
  Dosen,
  DosenInput,
  IpcResult,
  Jadwal,
  JadwalInput,
  JadwalSnapshot,
  Kelas,
  KelasInput,
  Kurikulum,
  KurikulumInput,
  KurikulumMapping,
  KurikulumMappingInput,
  KurikulumMappingPatch,
  MataKuliah,
  MataKuliahInput,
  PenugasanDosen,
  ProgramStudi,
  ProgramStudiInput,
  WaktuSks
} from '../../shared/api'
import type { Persistence } from './persistence'

function wrap<T>(fn: () => T): IpcResult<T> {
  try {
    return { ok: true, value: fn() }
  } catch (cause) {
    if (isApiError(cause)) {
      return { ok: false, error: cause }
    }
    const message = cause instanceof Error ? cause.message : String(cause)
    return { ok: false, error: { code: 'INTERNAL', message } satisfies ApiError }
  }
}

export function registerPersistenceIpc(persistence: Persistence): void {
  ipcMain.handle('waktu-sks:get', (): IpcResult<WaktuSks> => wrap(() => persistence.getWaktuSks()))
  ipcMain.handle('waktu-sks:update', (_event, input: WaktuSks): IpcResult<void> =>
    wrap(() => {
      persistence.updateWaktuSks(input)
    })
  )

  ipcMain.handle('program-studi:list', (): IpcResult<ProgramStudi[]> =>
    wrap(() => persistence.listProgramStudi())
  )
  ipcMain.handle(
    'program-studi:create',
    (_event, input: ProgramStudiInput): IpcResult<ProgramStudi> =>
      wrap(() => persistence.createProgramStudi(input))
  )
  ipcMain.handle(
    'program-studi:update',
    (_event, id: number, input: ProgramStudiInput): IpcResult<ProgramStudi> =>
      wrap(() => persistence.updateProgramStudi(id, input))
  )
  ipcMain.handle('program-studi:delete', (_event, id: number): IpcResult<void> =>
    wrap(() => {
      persistence.deleteProgramStudi(id)
    })
  )

  ipcMain.handle('mata-kuliah:list', (): IpcResult<MataKuliah[]> =>
    wrap(() => persistence.listMataKuliah())
  )
  ipcMain.handle('mata-kuliah:create', (_event, input: MataKuliahInput): IpcResult<MataKuliah> =>
    wrap(() => persistence.createMataKuliah(input))
  )
  ipcMain.handle(
    'mata-kuliah:update',
    (_event, id: number, input: MataKuliahInput): IpcResult<MataKuliah> =>
      wrap(() => persistence.updateMataKuliah(id, input))
  )
  ipcMain.handle('mata-kuliah:delete', (_event, id: number): IpcResult<void> =>
    wrap(() => {
      persistence.deleteMataKuliah(id)
    })
  )

  ipcMain.handle('dosen:list', (): IpcResult<Dosen[]> => wrap(() => persistence.listDosen()))
  ipcMain.handle('dosen:create', (_event, input: DosenInput): IpcResult<Dosen> =>
    wrap(() => persistence.createDosen(input))
  )
  ipcMain.handle('dosen:update', (_event, id: number, input: DosenInput): IpcResult<Dosen> =>
    wrap(() => persistence.updateDosen(id, input))
  )
  ipcMain.handle('dosen:delete', (_event, id: number): IpcResult<void> =>
    wrap(() => {
      persistence.deleteDosen(id)
    })
  )

  ipcMain.handle('kurikulum:list', (_event, programStudiId: number): IpcResult<Kurikulum[]> =>
    wrap(() => persistence.listKurikulum(programStudiId))
  )
  ipcMain.handle('kurikulum:create', (_event, input: KurikulumInput): IpcResult<Kurikulum> =>
    wrap(() => persistence.createKurikulum(input))
  )
  ipcMain.handle(
    'kurikulum:update',
    (_event, id: number, input: KurikulumInput): IpcResult<Kurikulum> =>
      wrap(() => persistence.updateKurikulum(id, input))
  )
  ipcMain.handle('kurikulum:delete', (_event, id: number): IpcResult<void> =>
    wrap(() => {
      persistence.deleteKurikulum(id)
    })
  )

  ipcMain.handle(
    'kurikulum-mapping:list',
    (_event, kurikulumId: number): IpcResult<KurikulumMapping[]> =>
      wrap(() => persistence.listKurikulumMappings(kurikulumId))
  )
  ipcMain.handle(
    'kurikulum-mapping:add',
    (_event, input: KurikulumMappingInput): IpcResult<KurikulumMapping> =>
      wrap(() => persistence.addKurikulumMapping(input))
  )
  ipcMain.handle(
    'kurikulum-mapping:add-many',
    (_event, inputs: KurikulumMappingInput[]): IpcResult<KurikulumMapping[]> =>
      wrap(() => persistence.addKurikulumMappings(inputs))
  )
  ipcMain.handle(
    'kurikulum-mapping:update',
    (_event, id: number, input: KurikulumMappingPatch): IpcResult<KurikulumMapping> =>
      wrap(() => persistence.updateKurikulumMapping(id, input))
  )
  ipcMain.handle('kurikulum-mapping:remove', (_event, id: number): IpcResult<void> =>
    wrap(() => {
      persistence.removeKurikulumMapping(id)
    })
  )

  ipcMain.handle('jadwal:list', (_event, programStudiId: number): IpcResult<Jadwal[]> =>
    wrap(() => persistence.listJadwal(programStudiId))
  )
  ipcMain.handle('jadwal:get', (_event, id: number): IpcResult<Jadwal> =>
    wrap(() => persistence.getJadwal(id))
  )
  ipcMain.handle('jadwal:create', (_event, input: JadwalInput): IpcResult<Jadwal> =>
    wrap(() => persistence.createJadwal(input))
  )
  ipcMain.handle('jadwal:delete', (_event, id: number): IpcResult<void> =>
    wrap(() => {
      persistence.deleteJadwal(id)
    })
  )
  ipcMain.handle(
    'jadwal-snapshot:list',
    (_event, jadwalId: number): IpcResult<JadwalSnapshot[]> =>
      wrap(() => persistence.listJadwalSnapshots(jadwalId))
  )

  ipcMain.handle('kelas:list', (_event, jadwalId: number): IpcResult<Kelas[]> =>
    wrap(() => persistence.listKelas(jadwalId))
  )
  ipcMain.handle('kelas:create', (_event, input: KelasInput): IpcResult<Kelas> =>
    wrap(() => persistence.createKelas(input))
  )
  ipcMain.handle(
    'kelas:update',
    (_event, id: number, input: KelasInput): IpcResult<Kelas> =>
      wrap(() => persistence.updateKelas(id, input))
  )
  ipcMain.handle('kelas:delete', (_event, id: number): IpcResult<void> =>
    wrap(() => {
      persistence.deleteKelas(id)
    })
  )

  ipcMain.handle('bentrok:list', (_event, jadwalId: number): IpcResult<Bentrok[]> =>
    wrap(() => persistence.listBentrok(jadwalId))
  )
  ipcMain.handle(
    'bentrok-semester-ke:list',
    (_event, jadwalId: number): IpcResult<BentrokSemesterKe[]> =>
      wrap(() => persistence.listBentrokSemesterKe(jadwalId))
  )
  ipcMain.handle('tahun-akademik:list', (): IpcResult<string[]> =>
    wrap(() => persistence.listTahunAkademik())
  )
  ipcMain.handle(
    'penugasan-dosen:list',
    (_event, tahunAkademik: string): IpcResult<PenugasanDosen[]> =>
      wrap(() => persistence.listPenugasanDosen(tahunAkademik))
  )
}
