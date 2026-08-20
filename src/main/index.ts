import { join } from 'path'
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import type {
  ExportBebanDosenXlsxInput,
  ExportBebanDosenXlsxResult,
  ExportJadwalXlsxResult,
  IpcResult
} from '../shared/api'
import { isApiError, type ApiError } from '../shared/api-error'
import { prepareBebanDosenXlsx, prepareJadwalXlsx } from './export-xlsx'
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
): Promise<ExportJadwalXlsxResult> {
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

function registerExportIpc(db: Persistence): void {
  ipcMain.handle(
    'jadwal:export-xlsx',
    (_event, jadwalIds: number[]): Promise<IpcResult<ExportJadwalXlsxResult>> =>
      wrapAsync(async () => {
        const prepared = prepareJadwalXlsx(db, jadwalIds)
        return saveWorkbook(prepared.workbook, prepared.filename)
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
    persistence = openDatabaseOrQuit()
    if (!persistence) {
      return
    }
    registerPersistenceIpc(persistence)
    registerExportIpc(persistence)
    createWindow()
  })
}

app.on('window-all-closed', () => {
  persistence?.close()
  persistence = null
  app.quit()
})
