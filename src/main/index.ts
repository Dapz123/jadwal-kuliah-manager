import { existsSync } from 'fs'
import { join } from 'path'
import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron'
import { apiError } from '../shared/api-error'
import type {
  ExportBebanDosenXlsxInput,
  ExportBebanDosenXlsxResult,
  ExportJadwalXlsxResult,
  ExportRekapMkXlsxInput,
  ExportRekapMkXlsxResult,
  IpcResult
} from '../shared/api'
import { isApiError, type ApiError } from '../shared/api-error'
import { prepareBebanDosenXlsx, prepareJadwalXlsx, prepareRekapMkXlsx } from './export-xlsx'
import { registerPersistenceIpc } from './persistence/ipc'
import { resolveDatabasePath } from './persistence/path'
import { openPersistence, type Persistence } from './persistence/persistence'

let mainWindow: BrowserWindow | null = null
let persistence: Persistence | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    show: false,
    title: 'Jadwal Kuliah Manager',
    // stopgap: Fluent people-edit-16-filled; replace build/icon.png
    icon: app.isPackaged ? undefined : join(__dirname, '../../build/icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (!app.isPackaged && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

async function wrapAsync<T>(fn: () => Promise<T>): Promise<IpcResult<T>> {
  try {
    return { ok: true, value: await fn() }
  } catch (cause) {
    if (isApiError(cause)) {
      return { ok: false, error: cause }
    }
    const message = cause instanceof Error ? cause.message : String(cause)
    return { ok: false, error: { code: 'INTERNAL', message } satisfies ApiError }
  }
}

async function saveWorkbook(
  workbook: { xlsx: { writeFile: (path: string) => Promise<void> } },
  filename: string
): Promise<{ canceled: true } | { path: string }> {
  const options = {
    defaultPath: filename,
    filters: [{ name: 'XLSX', extensions: ['xlsx'] }]
  }
  const result = mainWindow
    ? await dialog.showSaveDialog(mainWindow, options)
    : await dialog.showSaveDialog(options)
  if (result.canceled || result.filePath == null || result.filePath === '') {
    return { canceled: true as const }
  }
  await workbook.xlsx.writeFile(result.filePath)
  return { path: result.filePath }
}

function registerShellIpc(): void {
  ipcMain.handle(
    'shell:show-item-in-folder',
    (_event, filePath: string): Promise<IpcResult<void>> =>
      wrapAsync(async () => {
        if (!existsSync(filePath)) {
          throw apiError('NOT_FOUND', 'File tidak ditemukan')
        }
        shell.showItemInFolder(filePath)
      })
  )
}

function registerExportIpc(db: Persistence): void {
  ipcMain.handle(
    'jadwal:export-xlsx',
    (_event, jadwalIds: number[]): Promise<IpcResult<ExportJadwalXlsxResult>> =>
      wrapAsync(async () => {
        const prepared = prepareJadwalXlsx(db, jadwalIds)
        const saved = await saveWorkbook(prepared.workbook, prepared.filename)
        if ('path' in saved) {
          return { path: saved.path, gelarWarnings: prepared.gelarWarnings }
        }
        return saved
      })
  )
  ipcMain.handle(
    'beban-dosen:export-xlsx',
    (_event, input: ExportBebanDosenXlsxInput): Promise<IpcResult<ExportBebanDosenXlsxResult>> =>
      wrapAsync(async () => {
        const prepared = prepareBebanDosenXlsx(db, input)
        return saveWorkbook(prepared.workbook, prepared.filename)
      })
  )
  ipcMain.handle(
    'rekap-mk:export-xlsx',
    (_event, input: ExportRekapMkXlsxInput): Promise<IpcResult<ExportRekapMkXlsxResult>> =>
      wrapAsync(async () => {
        const prepared = prepareRekapMkXlsx(db, input)
        return saveWorkbook(prepared.workbook, prepared.filename)
      })
  )
}

function openDatabaseOrQuit(): Persistence | null {
  const dbPath = resolveDatabasePath({
    portableExecutableDir: process.env.PORTABLE_EXECUTABLE_DIR,
    projectRoot: join(__dirname, '../..')
  })

  try {
    return openPersistence(dbPath)
  } catch (cause) {
    const message = isApiError(cause)
      ? `[${cause.code}] ${cause.message}`
      : cause instanceof Error
        ? cause.message
        : String(cause)
    dialog.showErrorBox('Database tidak dapat dibuka', message)
    app.quit()
    return null
  }
}

const gotTheLock = app.requestSingleInstanceLock()

if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (!mainWindow) {
      return
    }
    if (mainWindow.isMinimized()) {
      mainWindow.restore()
    }
    mainWindow.focus()
  })

  app.whenReady().then(() => {
    app.setAppUserModelId('id.kampus.jadwalkuliah')
    if (app.isPackaged) {
      Menu.setApplicationMenu(null)
    }
    persistence = openDatabaseOrQuit()
    if (!persistence) {
      return
    }
    registerPersistenceIpc(persistence)
    registerShellIpc()
    registerExportIpc(persistence)
    createWindow()
  })
}

app.on('window-all-closed', () => {
  persistence?.close()
  persistence = null
  app.quit()
})
