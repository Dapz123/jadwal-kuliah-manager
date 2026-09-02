import ExcelJS from 'exceljs'
import type { Alignment, Border, Borders, Fill, Font, Worksheet } from 'exceljs'
import { apiError } from '../shared/api-error.ts'
import type { JenisKelas, Semester } from '../shared/api.ts'
import { dosenNamaExport } from '../shared/dosen-nama.ts'
import {
  BEBAN_HEADERS,
  BEBAN_TITLE,
  bebanProdiTitle,
  bebanTahunTitle,
  exportBebanFilename,
  packBebanDosen,
  PENUGASAN_SHEET_NAME,
  type BebanPackKelas
} from '../shared/export-beban.ts'
import {
  exportRekapMkFilename,
  packRekapMk,
  REKAP_MK_GRAND_LABEL,
  REKAP_MK_HEADERS,
  REKAP_MK_TITLE,
  REKAP_MK_TOTAL_LABEL,
  rekapMkTahunTitle,
  type RekapMkPackMk,
  type RekapMkPacked
} from '../shared/export-rekap-mk.ts'
import {
  compareExportJadwalMeta,
  DAY_HALF_COL_WIDTH,
  exportSheetName,
  exportWorkbookFilename,
  formatJamRentang,
  mkCellLabel,
  packJadwalGrid,
  slotMkLabels,
  WEEKDAY_LABELS,
  wrapRowHeightPt,
  type ExportJadwalMeta,
  type PackedGrid,
  type PackedSlot
} from '../shared/export-grid.ts'
import { semesterKeRoman } from '../shared/semester-ke.ts'
import type { Persistence } from './persistence/persistence.ts'

const DAY_LABELS = WEEKDAY_LABELS

const FONT_TITLE: Partial<Font> = { name: 'Agency FB', size: 18, bold: true }
const FONT_HEADER: Partial<Font> = { name: 'Agency FB', size: 14, bold: true }
const FONT_BODY: Partial<Font> = { name: 'Agency FB', size: 12 }
const FONT_BEBAN_TITLE: Partial<Font> = { name: 'Calibri', size: 16, bold: true }
const FONT_BEBAN_HEADER: Partial<Font> = { name: 'Calibri', size: 14, bold: true }
const FONT_BEBAN_BODY: Partial<Font> = { name: 'Calibri', size: 11 }
const FONT_PENUGASAN_TITLE: Partial<Font> = { name: 'Calibri', size: 12, bold: true }
const FONT_PENUGASAN_HEADER: Partial<Font> = { name: 'Calibri', size: 11, bold: true }
const FONT_PENUGASAN_BODY: Partial<Font> = { name: 'Calibri', size: 10 }

/** Folio / F4 Indonesia 215×330 mm — closest built-in Excel paper size. */
const PENUGASAN_PAPER_SIZE = 14 as ExcelJS.PaperSize
const PENUGASAN_SPACER_HEIGHT_PT = 5
const PENUGASAN_PRINT_MARGINS = {
  left: 1 / 2.54,
  right: 1 / 2.54,
  top: 2 / 2.54,
  bottom: 2 / 2.54,
  header: 0.3,
  footer: 0.3
}
/** No | Dosen | MK (min 25) | SKS | Kelas | Hari | Jam */
const PENUGASAN_COL_WIDTHS = [4, 23, 35, 6, 14, 7, 11] as const

const FILL_HEADER: Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFBFBFBF' }
}
const FILL_VACANT: Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF808080' }
}
const FILL_TOTAL_SKS: Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFFFFF00' }
}
const FILL_SPACER: Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFD9D9D9' }
}

const THIN: Partial<Border> = { style: 'thin' }
const DOUBLE: Partial<Border> = { style: 'double' }
const BORDER_BOX: Partial<Borders> = { top: THIN, left: THIN, bottom: THIN, right: THIN }
const BORDER_SPACER: Partial<Borders> = { top: THIN, bottom: THIN }
const BORDER_TIME: Partial<Borders> = { top: THIN, left: THIN, right: THIN }
const BORDER_MK: Partial<Borders> = { left: THIN, right: THIN }
const BORDER_DOSEN: Partial<Borders> = { left: THIN, bottom: THIN, right: THIN }
const SMT_COL_WIDTH = 6
const SLOT_JAM_ROW_HEIGHT_PT = 20
const SLOT_DOSEN_ROW_HEIGHT_PT = 20

const ALIGN_CENTER = { horizontal: 'center' as const, vertical: 'middle' as const }
const ALIGN_WRAP = { ...ALIGN_CENTER, wrapText: true }
const ALIGN_JAM = { horizontal: 'center' as const, vertical: 'bottom' as const }
const ALIGN_DOSEN = { horizontal: 'center' as const, vertical: 'top' as const, wrapText: true }

const LEMBAR_PRINT_MARGINS = {
  left: 0.25,
  right: 0.25,
  top: 2 / 2.54,
  bottom: 2 / 2.54,
  header: 0.25,
  footer: 0.25
}

type JadwalSheetInput = {
  sheetName: string
  programStudiNama: string
  jenisKelas: JenisKelas
  semester: Semester
  tahunAkademik: string
  grid: PackedGrid
}

function uniqueSheetName(used: Set<string>, base: string): string {
  let name = base.slice(0, 31)
  if (!used.has(name)) {
    used.add(name)
    return name
  }
  let n = 2
  for (;;) {
    const suffix = `-${n}`
    name = `${base.slice(0, Math.max(0, 31 - suffix.length))}${suffix}`
    if (!used.has(name)) {
      used.add(name)
      return name
    }
    n += 1
  }
}

function paintJadwalSheet(workbook: ExcelJS.Workbook, input: JadwalSheetInput): void {
  const slotCount = input.grid.slotCount
  const lastRow = 4 + slotCount * 3

  const sheet = workbook.addWorksheet(input.sheetName, {
    pageSetup: {
      paperSize: 9,
      orientation: 'landscape',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      horizontalCentered: true,
      margins: LEMBAR_PRINT_MARGINS,
      printArea: `A1:K${lastRow}`,
      printTitlesRow: '4:4'
    }
  })

  sheet.getColumn(1).width = SMT_COL_WIDTH
  for (let column = 2; column <= 11; column += 1) {
    sheet.getColumn(column).width = DAY_HALF_COL_WIDTH
  }

  sheet.mergeCells(1, 1, 1, 11)
  sheet.mergeCells(2, 1, 2, 11)
  const title = `JADWAL PERKULIAHAN ${input.programStudiNama}`.toUpperCase()
  const subtitle =
    `${input.jenisKelas} SEMESTER ${input.semester} TAHUN AKADEMIK ${input.tahunAkademik}`.toUpperCase()
  paintMerged(sheet, 1, 1, 1, 11, title, FONT_TITLE, ALIGN_CENTER)
  paintMerged(sheet, 2, 1, 2, 11, subtitle, FONT_TITLE, ALIGN_CENTER)
  sheet.getRow(1).height = 24
  sheet.getRow(2).height = 24

  sheet.getCell(4, 1).value = 'SMT'
  sheet.getCell(4, 1).font = FONT_HEADER
  sheet.getCell(4, 1).fill = FILL_HEADER
  sheet.getCell(4, 1).border = BORDER_BOX
  sheet.getCell(4, 1).alignment = ALIGN_CENTER

  for (let day = 0; day < 5; day += 1) {
    const left = 2 + day * 2
    const right = left + 1
    sheet.mergeCells(4, left, 4, right)
    paintMerged(
      sheet,
      4,
      left,
      4,
      right,
      DAY_LABELS[day],
      FONT_HEADER,
      ALIGN_CENTER,
      FILL_HEADER,
      BORDER_BOX
    )
  }
  sheet.getRow(4).height = 18

  for (const band of input.grid.semesterBands) {
    const startRow = 5 + band.start * 3
    const endRow = startRow + band.count * 3 - 1
    sheet.mergeCells(startRow, 1, endRow, 1)
    paintMerged(
      sheet,
      startRow,
      1,
      endRow,
      1,
      semesterKeRoman(band.semesterKe),
      FONT_BODY,
      ALIGN_CENTER,
      undefined,
      BORDER_BOX
    )
  }

  for (let day = 0; day < 5; day += 1) {
    const left = 2 + day * 2
    const right = left + 1
    const slots = input.grid.days[day]
    for (let index = 0; index < slotCount; index += 1) {
      paintSlot(sheet, 5 + index * 3, left, right, slots[index] ?? { kind: 'vacant' })
    }
  }

  for (let index = 0; index < slotCount; index += 1) {
    const startRow = 5 + index * 3
    sheet.getRow(startRow).height = SLOT_JAM_ROW_HEIGHT_PT
    sheet.getRow(startRow + 1).height = wrapRowHeightPt(slotMkLabels(input.grid.days, index))
    sheet.getRow(startRow + 2).height = SLOT_DOSEN_ROW_HEIGHT_PT
  }

  const bands = input.grid.semesterBands
  for (let i = 0; i < bands.length - 1; i += 1) {
    const endRow = 5 + bands[i].start * 3 + bands[i].count * 3 - 1
    const nextRow = endRow + 1
    const bandMaster = sheet.getCell(5 + bands[i].start * 3, 1)
    bandMaster.border = { ...bandMaster.border, bottom: DOUBLE }
    for (let column = 1; column <= 11; column += 1) {
      const above = sheet.getCell(endRow, column)
      above.border = { ...above.border, bottom: DOUBLE }
      const below = sheet.getCell(nextRow, column)
      below.border = { ...below.border, top: DOUBLE }
    }
  }
}

export function prepareJadwalXlsx(
  persistence: Persistence,
  jadwalIds: number[]
): { workbook: ExcelJS.Workbook; filename: string; gelarWarnings: string[] } {
  const ids = [...new Set(jadwalIds)]
  if (ids.length === 0) {
    throw apiError('JADWAL_INVALID', 'Pilih minimal satu Jadwal')
  }

  const programStudiById = new Map(
    persistence.listProgramStudi().map((row) => [row.id, row] as const)
  )
  const dosen = persistence.listDosen()

  type Entry = {
    meta: ExportJadwalMeta
    programStudiNama: string
    grid: PackedGrid
  }

  const entries: Entry[] = []
  for (const jadwalId of ids) {
    const jadwal = persistence.getJadwal(jadwalId)
    const programStudi = programStudiById.get(jadwal.programStudiId)
    if (!programStudi) {
      throw apiError('PROGRAM_STUDI_NOT_FOUND', 'Program Studi tidak ditemukan')
    }
    const meta: ExportJadwalMeta = {
      kode: programStudi.kode,
      tahunAkademik: jadwal.tahunAkademik,
      semester: jadwal.semester,
      jenisKelas: jadwal.jenisKelas
    }
    entries.push({
      meta,
      programStudiNama: programStudi.nama,
      grid: packJadwalGrid({
        snapshots: persistence.listJadwalSnapshots(jadwalId),
        kelas: persistence.listKelas(jadwalId),
        dosen
      })
    })
  }

  entries.sort((a, b) => compareExportJadwalMeta(a.meta, b.meta))

  const workbook = new ExcelJS.Workbook()
  const usedNames = new Set<string>()
  for (const entry of entries) {
    paintJadwalSheet(workbook, {
      sheetName: uniqueSheetName(usedNames, exportSheetName(entry.meta)),
      programStudiNama: entry.programStudiNama,
      jenisKelas: entry.meta.jenisKelas,
      semester: entry.meta.semester,
      tahunAkademik: entry.meta.tahunAkademik,
      grid: entry.grid
    })
  }

  return {
    workbook,
    filename: exportWorkbookFilename(entries.map((entry) => entry.meta)),
    gelarWarnings: uniqueGelarWarnings(entries.map((entry) => entry.grid.gelarWarnings))
  }
}

function uniqueGelarWarnings(groups: readonly string[][]): string[] {
  const seen = new Set<string>()
  const warnings: string[] = []
  for (const group of groups) {
    for (const item of group) {
      if (!seen.has(item)) {
        seen.add(item)
        warnings.push(item)
      }
    }
  }
  return warnings
}

export function prepareBebanDosenXlsx(
  persistence: Persistence,
  input: { tahunAkademik: string; semester: Semester; jadwalIds: number[] }
): { workbook: ExcelJS.Workbook; filename: string } {
  const ids = [...new Set(input.jadwalIds)]
  if (ids.length === 0) {
    throw apiError('JADWAL_INVALID', 'Pilih minimal satu Jadwal')
  }

  const programStudiById = new Map(
    persistence.listProgramStudi().map((row) => [row.id, row] as const)
  )
  const dosenById = new Map(persistence.listDosen().map((row) => [row.id, row] as const))
  const packedKelas: BebanPackKelas[] = []
  const selectedProdi: { kode: string; nama: string }[] = []
  const seenProdi = new Set<number>()

  for (const jadwalId of ids) {
    const jadwal = persistence.getJadwal(jadwalId)
    const programStudi = programStudiById.get(jadwal.programStudiId)
    if (!programStudi) {
      throw apiError('PROGRAM_STUDI_NOT_FOUND', 'Program Studi tidak ditemukan')
    }
    if (!seenProdi.has(programStudi.id)) {
      seenProdi.add(programStudi.id)
      selectedProdi.push({ kode: programStudi.kode, nama: programStudi.nama })
    }
    const snapshotById = new Map(
      persistence.listJadwalSnapshots(jadwalId).map((row) => [row.id, row] as const)
    )
    for (const kelas of persistence.listKelas(jadwalId)) {
      if (kelas.dosenId == null) {
        continue
      }
      const snapshot = snapshotById.get(kelas.snapshotMkId)
      const dosen = dosenById.get(kelas.dosenId)
      if (snapshot == null || dosen == null) {
        continue
      }
      packedKelas.push({
        dosen,
        kode: snapshot.kode,
        nama: snapshot.nama,
        sks: snapshot.sks,
        programStudiKode: programStudi.kode,
        semesterKe: snapshot.semesterKe,
        jenisKelas: jadwal.jenisKelas,
        hari: kelas.hari,
        jamMulai: kelas.jamMulai,
        jamSelesai: kelas.jamSelesai
      })
    }
  }

  const rows = packBebanDosen(packedKelas)
  const workbook = new ExcelJS.Workbook()
  const colCount = BEBAN_HEADERS.length
  const lastRow = 4 + rows.length
  const sheet = workbook.addWorksheet(PENUGASAN_SHEET_NAME, {
    pageSetup: {
      paperSize: PENUGASAN_PAPER_SIZE,
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 0,
      margins: PENUGASAN_PRINT_MARGINS,
      printArea: `A1:G${lastRow}`,
      printTitlesRow: '4:4'
    }
  })

  const titleAlign = { horizontal: 'center' as const, vertical: 'middle' as const }
  const alignNo: Partial<Alignment> = { horizontal: 'center', vertical: 'middle' }
  const alignNamaDosen: Partial<Alignment> = {
    horizontal: 'left',
    vertical: 'middle',
    wrapText: true
  }
  const alignBody: Partial<Alignment> = { vertical: 'middle' }
  const alignJamLike: Partial<Alignment> = { horizontal: 'center', vertical: 'middle' }

  sheet.mergeCells(1, 1, 1, colCount)
  sheet.mergeCells(2, 1, 2, colCount)
  sheet.mergeCells(3, 1, 3, colCount)
  paintMerged(sheet, 1, 1, 1, colCount, BEBAN_TITLE, FONT_PENUGASAN_TITLE, titleAlign)
  paintMerged(
    sheet,
    2,
    1,
    2,
    colCount,
    bebanProdiTitle(selectedProdi),
    FONT_PENUGASAN_TITLE,
    titleAlign
  )
  paintMerged(
    sheet,
    3,
    1,
    3,
    colCount,
    bebanTahunTitle(input.tahunAkademik, input.semester),
    FONT_PENUGASAN_TITLE,
    titleAlign
  )

  for (let column = 1; column <= colCount; column += 1) {
    const cell = sheet.getCell(4, column)
    cell.value = BEBAN_HEADERS[column - 1]
    cell.font = FONT_PENUGASAN_HEADER
    cell.alignment = titleAlign
    cell.border = BORDER_BOX
    cell.fill = FILL_HEADER
  }

  let mergeStart: number | null = null

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index]
    const excelRowIndex = index + 5
    const values: Array<string | number | null> = [
      row.no === '' ? null : row.no,
      row.namaDosen || null,
      row.mataKuliah || null,
      row.sks === '' ? null : row.sks,
      row.kelas || null,
      row.hari || null,
      row.jam || null
    ]

    if (row.kind === 'spacer') {
      sheet.getRow(excelRowIndex).height = PENUGASAN_SPACER_HEIGHT_PT
      for (let column = 1; column <= colCount; column += 1) {
        const cell = sheet.getCell(excelRowIndex, column)
        cell.fill = FILL_SPACER
        cell.border = BORDER_SPACER
      }
      continue
    }

    const bold = row.kind === 'total' || row.kind === 'grand'
    const font = bold ? { ...FONT_PENUGASAN_BODY, bold: true } : FONT_PENUGASAN_BODY
    for (let column = 1; column <= colCount; column += 1) {
      const cell = sheet.getCell(excelRowIndex, column)
      cell.value = values[column - 1]
      cell.font = font
      cell.border = BORDER_BOX
      if (column === 1) {
        cell.alignment = alignNo
      } else if (column === 2) {
        cell.alignment = alignNamaDosen
      } else if (column === 4 || column === 5 || column === 6 || column === 7) {
        cell.alignment = alignJamLike
      } else {
        cell.alignment = alignBody
      }
    }

    if (row.kind === 'total' || row.kind === 'grand') {
      sheet.getCell(excelRowIndex, 4).fill = FILL_TOTAL_SKS
      sheet.mergeCells(excelRowIndex, 5, excelRowIndex, 7)
      const slotCell = sheet.getCell(excelRowIndex, 5)
      slotCell.font = font
      slotCell.border = BORDER_BOX
      slotCell.alignment = alignJamLike
    }

    if (typeof row.no === 'number') {
      mergeStart = excelRowIndex
    }
    if (row.kind === 'total' && mergeStart != null) {
      if (mergeStart < excelRowIndex) {
        sheet.mergeCells(mergeStart, 1, excelRowIndex, 1)
        sheet.mergeCells(mergeStart, 2, excelRowIndex, 2)
      }
      for (let r = mergeStart; r <= excelRowIndex; r += 1) {
        const noCell = sheet.getCell(r, 1)
        noCell.border = BORDER_BOX
        noCell.alignment = alignNo
        noCell.font = FONT_PENUGASAN_BODY
        const namaCell = sheet.getCell(r, 2)
        namaCell.border = BORDER_BOX
        namaCell.alignment = alignNamaDosen
        namaCell.font = FONT_PENUGASAN_BODY
      }
      mergeStart = null
    }
  }

  PENUGASAN_COL_WIDTHS.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width
  })

  return {
    workbook,
    filename: exportBebanFilename(input.tahunAkademik, input.semester)
  }
}

const REKAP_MK_COL_COUNT = REKAP_MK_HEADERS.length
const REKAP_MK_PRINT_MARGINS = {
  left: 0.7,
  right: 0.7,
  top: 0.75,
  bottom: 0.75,
  header: 0.3,
  footer: 0.3
}

function buildRekapMkPackForProdi(
  persistence: Persistence,
  pagiJadwalId: number | null,
  soreJadwalId: number | null,
  dosenById: Map<number, ReturnType<Persistence['listDosen']>[number]>
): RekapMkPackMk[] {
  const snapshotsByKode = new Map<
    string,
    ReturnType<Persistence['listJadwalSnapshots']>[number]
  >()

  function addSnapshots(jadwalId: number | null): void {
    if (jadwalId == null) {
      return
    }
    for (const snap of persistence.listJadwalSnapshots(jadwalId)) {
      if (!snapshotsByKode.has(snap.kode)) {
        snapshotsByKode.set(snap.kode, snap)
      }
    }
  }
  addSnapshots(pagiJadwalId)
  addSnapshots(soreJadwalId)

  function dosenFor(jadwalId: number | null, kode: string): string {
    if (jadwalId == null) {
      return ''
    }
    const snap = persistence.listJadwalSnapshots(jadwalId).find((row) => row.kode === kode)
    if (snap == null) {
      return ''
    }
    const kelas = persistence.listKelas(jadwalId).find((row) => row.snapshotMkId === snap.id)
    if (kelas?.dosenId == null) {
      return ''
    }
    const dosen = dosenById.get(kelas.dosenId)
    return dosen == null ? '' : dosenNamaExport(dosen)
  }

  return [...snapshotsByKode.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([kode, snap]) => ({
      kode,
      nama: snap.nama,
      sks: snap.sks,
      semesterKe: snap.semesterKe,
      dosenPagi: dosenFor(pagiJadwalId, kode),
      dosenSore: dosenFor(soreJadwalId, kode)
    }))
}

function paintRekapMkSheet(
  workbook: ExcelJS.Workbook,
  input: {
    sheetName: string
    programStudiNama: string
    tahunAkademik: string
    semester: Semester
    packed: RekapMkPacked
  }
): void {
  const packed = input.packed
  const bodyRowCount =
    packed.bands.reduce((sum, band) => sum + band.rows.length + 1, 0) + 1
  const lastRow = 4 + bodyRowCount

  const sheet = workbook.addWorksheet(input.sheetName, {
    pageSetup: {
      paperSize: 9,
      orientation: 'portrait',
      fitToPage: true,
      fitToWidth: 1,
      fitToHeight: 1,
      margins: REKAP_MK_PRINT_MARGINS,
      printArea: `A1:F${lastRow}`
    }
  })

  const titleAlign = { horizontal: 'center' as const, vertical: 'middle' as const }
  const alignCenter: Partial<Alignment> = { horizontal: 'center', vertical: 'middle' }
  const alignBody: Partial<Alignment> = { vertical: 'middle' }
  const alignNamaDosen: Partial<Alignment> = { horizontal: 'left', vertical: 'middle' }

  sheet.mergeCells(1, 1, 1, REKAP_MK_COL_COUNT)
  sheet.mergeCells(2, 1, 2, REKAP_MK_COL_COUNT)
  sheet.mergeCells(3, 1, 3, REKAP_MK_COL_COUNT)
  paintMerged(sheet, 1, 1, 1, REKAP_MK_COL_COUNT, REKAP_MK_TITLE, FONT_BEBAN_TITLE, titleAlign)
  paintMerged(
    sheet,
    2,
    1,
    2,
    REKAP_MK_COL_COUNT,
    input.programStudiNama,
    FONT_BEBAN_TITLE,
    titleAlign
  )
  paintMerged(
    sheet,
    3,
    1,
    3,
    REKAP_MK_COL_COUNT,
    rekapMkTahunTitle(input.tahunAkademik, input.semester),
    FONT_BEBAN_TITLE,
    titleAlign
  )

  for (let column = 1; column <= REKAP_MK_COL_COUNT; column += 1) {
    const cell = sheet.getCell(4, column)
    cell.value = REKAP_MK_HEADERS[column - 1]
    cell.font = FONT_BEBAN_HEADER
    cell.alignment = titleAlign
    cell.border = BORDER_BOX
    cell.fill = FILL_HEADER
  }

  let excelRow = 5
  for (const band of packed.bands) {
    const bandStart = excelRow
    for (const row of band.rows) {
      sheet.getCell(excelRow, 1).value = row.no
      sheet.getCell(excelRow, 3).value = row.namaMk
      sheet.getCell(excelRow, 4).value = row.sks
      if (row.mergeDosen) {
        sheet.mergeCells(excelRow, 5, excelRow, 6)
        sheet.getCell(excelRow, 5).value = row.dosenPagi
      } else {
        sheet.getCell(excelRow, 5).value = row.dosenPagi
        sheet.getCell(excelRow, 6).value = row.dosenSore
      }
      for (let column = 1; column <= REKAP_MK_COL_COUNT; column += 1) {
        const cell = sheet.getCell(excelRow, column)
        cell.font = FONT_BEBAN_BODY
        cell.border = BORDER_BOX
        if (column === 1 || column === 2 || column === 4) {
          cell.alignment = alignCenter
        } else if (column >= 5) {
          cell.alignment = alignNamaDosen
        } else {
          cell.alignment = alignBody
        }
      }
      excelRow += 1
    }
    if (band.rows.length > 0) {
      sheet.mergeCells(bandStart, 2, excelRow - 1, 2)
      paintMerged(
        sheet,
        bandStart,
        2,
        excelRow - 1,
        2,
        band.smsLabel,
        FONT_BEBAN_BODY,
        alignCenter,
        undefined,
        BORDER_BOX
      )
    }

    sheet.mergeCells(excelRow, 1, excelRow, 3)
    sheet.mergeCells(excelRow, 5, excelRow, 6)
    sheet.getCell(excelRow, 1).value = REKAP_MK_TOTAL_LABEL
    sheet.getCell(excelRow, 4).value = band.totalSks
    for (let column = 1; column <= REKAP_MK_COL_COUNT; column += 1) {
      const cell = sheet.getCell(excelRow, column)
      cell.font = { ...FONT_BEBAN_BODY, bold: true }
      cell.border = BORDER_BOX
      if (column === 1) {
        cell.alignment = alignBody
      } else if (column === 4) {
        cell.alignment = alignCenter
      }
    }
    excelRow += 1
  }

  sheet.mergeCells(excelRow, 1, excelRow, 3)
  sheet.mergeCells(excelRow, 5, excelRow, 6)
  sheet.getCell(excelRow, 1).value = REKAP_MK_GRAND_LABEL
  sheet.getCell(excelRow, 4).value = packed.grandSks
  for (let column = 1; column <= REKAP_MK_COL_COUNT; column += 1) {
    const cell = sheet.getCell(excelRow, column)
    cell.font = { ...FONT_BEBAN_BODY, bold: true }
    cell.border = BORDER_BOX
    if (column === 4) {
      cell.fill = FILL_TOTAL_SKS
      cell.alignment = alignCenter
    } else if (column === 1) {
      cell.alignment = alignBody
    }
  }

  const widths = [5, 6, 25, 8, 35, 35]
  widths.forEach((width, index) => {
    sheet.getColumn(index + 1).width = width
  })
}

export function prepareRekapMkXlsx(
  persistence: Persistence,
  input: { tahunAkademik: string; semester: Semester; jadwalIds: number[] }
): { workbook: ExcelJS.Workbook; filename: string } {
  const ids = [...new Set(input.jadwalIds)]
  if (ids.length === 0) {
    throw apiError('JADWAL_INVALID', 'Pilih minimal satu Jadwal')
  }

  const programStudiById = new Map(
    persistence.listProgramStudi().map((row) => [row.id, row] as const)
  )
  const dosenById = new Map(persistence.listDosen().map((row) => [row.id, row] as const))

  type ProdiEntry = {
    programStudiId: number
    kode: string
    nama: string
    pagiJadwalId: number | null
    soreJadwalId: number | null
  }

  const byProdi = new Map<number, ProdiEntry>()
  for (const jadwalId of ids) {
    const jadwal = persistence.getJadwal(jadwalId)
    const programStudi = programStudiById.get(jadwal.programStudiId)
    if (!programStudi) {
      throw apiError('PROGRAM_STUDI_NOT_FOUND', 'Program Studi tidak ditemukan')
    }
    let entry = byProdi.get(programStudi.id)
    if (!entry) {
      entry = {
        programStudiId: programStudi.id,
        kode: programStudi.kode,
        nama: programStudi.nama.trim() !== '' ? programStudi.nama : programStudi.kode,
        pagiJadwalId: null,
        soreJadwalId: null
      }
      byProdi.set(programStudi.id, entry)
    }
    if (jadwal.jenisKelas === 'Reguler Pagi') {
      entry.pagiJadwalId = jadwalId
    } else {
      entry.soreJadwalId = jadwalId
    }
  }

  const entries = [...byProdi.values()].sort((a, b) => a.kode.localeCompare(b.kode))
  const workbook = new ExcelJS.Workbook()
  const usedNames = new Set<string>()
  const multiSheet = entries.length > 1

  for (const entry of entries) {
    const packed = packRekapMk(
      buildRekapMkPackForProdi(
        persistence,
        entry.pagiJadwalId,
        entry.soreJadwalId,
        dosenById
      )
    )
    const baseName = multiSheet ? entry.kode : 'Rekap MK'
    paintRekapMkSheet(workbook, {
      sheetName: uniqueSheetName(usedNames, baseName),
      programStudiNama: entry.nama,
      tahunAkademik: input.tahunAkademik,
      semester: input.semester,
      packed
    })
  }

  return {
    workbook,
    filename: exportRekapMkFilename(
      input.tahunAkademik,
      input.semester,
      entries.map((entry) => entry.kode)
    )
  }
}

function paintSlot(
  sheet: Worksheet,
  startRow: number,
  left: number,
  right: number,
  slot: PackedSlot
): void {
  const vacant = slot.kind === 'vacant'
  const fill = vacant ? FILL_VACANT : undefined
  const timeRow = startRow
  const mkRow = startRow + 1
  const dosenRow = startRow + 2

  sheet.mergeCells(timeRow, left, timeRow, right)
  const timeValue =
    !vacant && slot.jamMulai != null && slot.jamSelesai != null
      ? formatJamRentang(slot.jamMulai, slot.jamSelesai)
      : ''
  paintMerged(
    sheet,
    timeRow,
    left,
    timeRow,
    right,
    timeValue,
    FONT_BODY,
    ALIGN_JAM,
    fill,
    BORDER_TIME
  )

  sheet.mergeCells(mkRow, left, mkRow, right)
  const mkValue = vacant ? '' : mkCellLabel(slot.mkNama, slot.sks)
  paintMerged(sheet, mkRow, left, mkRow, right, mkValue, FONT_BODY, ALIGN_WRAP, fill, BORDER_MK)

  sheet.mergeCells(dosenRow, left, dosenRow, right)
  const dosenValue = vacant ? '' : slot.dosenNama
  paintMerged(
    sheet,
    dosenRow,
    left,
    dosenRow,
    right,
    dosenValue,
    FONT_BODY,
    ALIGN_DOSEN,
    fill,
    BORDER_DOSEN
  )
}

function paintMerged(
  sheet: Worksheet,
  r1: number,
  c1: number,
  r2: number,
  c2: number,
  value: string,
  font: Partial<Font>,
  alignment: Partial<Alignment>,
  fill?: Fill,
  border?: Partial<Borders>
): void {
  const master = sheet.getCell(r1, c1)
  master.value = value
  for (let row = r1; row <= r2; row += 1) {
    for (let column = c1; column <= c2; column += 1) {
      const cell = sheet.getCell(row, column)
      cell.font = font
      cell.alignment = alignment
      cell.border = border ?? cell.border
      if (fill) {
        cell.fill = fill
      }
    }
  }
}
