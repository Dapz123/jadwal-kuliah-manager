export { dosenNamaLengkap } from '../../../shared/dosen-nama.ts'

export function filterByVisibleText<T>(
  rows: T[],
  query: string,
  visibleFields: (row: T) => Array<string | number | null | undefined>
): T[] {
  const needle = query.trim().toLowerCase()
  if (!needle) {
    return rows
  }
  return rows.filter((row) =>
    visibleFields(row).some(
      (field) => field != null && String(field).toLowerCase().includes(needle)
    )
  )
}

function filled(value: string): boolean {
  return value.trim() !== ''
}

export function programStudiSubmitEnabled(input: { kode: string; nama: string }): boolean {
  return filled(input.kode) && filled(input.nama)
}

export function mataKuliahSubmitEnabled(input: {
  kode: string
  nama: string
  sks: string
}): boolean {
  return filled(input.kode) && filled(input.nama) && filled(input.sks)
}

export function dosenSubmitEnabled(input: { nama: string; nidn: string; nuptk: string }): boolean {
  return filled(input.nama) && (filled(input.nidn) || filled(input.nuptk))
}

export function kurikulumSubmitEnabled(input: { nama: string }): boolean {
  return filled(input.nama)
}

export function mappingSubmitEnabled(input: {
  selectedCount: number
  semester: '' | 'Ganjil' | 'Genap'
}): boolean {
  return input.selectedCount >= 1 && (input.semester === 'Ganjil' || input.semester === 'Genap')
}

function emptyMkSks(): { mk: number; sks: number } {
  return { mk: 0, sks: 0 }
}

function addMkSks(target: { mk: number; sks: number }, sks: number): void {
  target.mk += 1
  target.sks += sks
}

export function kurikulumMkTotals(
  mappings: ReadonlyArray<{ semester: string; semesterKe: number | null; sks: number }>
): {
  ganjil: { mk: number; sks: number }
  genap: { mk: number; sks: number }
  ke: Array<{ mk: number; sks: number }>
  tanpaKeGanjil: { mk: number; sks: number }
  tanpaKeGenap: { mk: number; sks: number }
} {
  const ke = Array.from({ length: 8 }, emptyMkSks)
  const ganjil = emptyMkSks()
  const genap = emptyMkSks()
  const tanpaKeGanjil = emptyMkSks()
  const tanpaKeGenap = emptyMkSks()
  for (const row of mappings) {
    if (row.semester === 'Ganjil') {
      addMkSks(ganjil, row.sks)
      if (row.semesterKe == null) {
        addMkSks(tanpaKeGanjil, row.sks)
      }
    } else if (row.semester === 'Genap') {
      addMkSks(genap, row.sks)
      if (row.semesterKe == null) {
        addMkSks(tanpaKeGenap, row.sks)
      }
    }
    if (row.semesterKe != null && row.semesterKe >= 1 && row.semesterKe <= 8) {
      addMkSks(ke[row.semesterKe - 1]!, row.sks)
    }
  }
  return { ganjil, genap, ke, tanpaKeGanjil, tanpaKeGenap }
}

export function sortKurikulumMappings<T extends { semesterKe: number | null; mataKuliahId: number }>(
  mappings: T[],
  kodeOf: (mataKuliahId: number) => string
): T[] {
  return mappings.slice().sort((a, b) => {
    if (a.semesterKe == null && b.semesterKe == null) {
      return kodeOf(a.mataKuliahId).localeCompare(kodeOf(b.mataKuliahId))
    }
    if (a.semesterKe == null) {
      return 1
    }
    if (b.semesterKe == null) {
      return -1
    }
    return a.semesterKe - b.semesterKe || kodeOf(a.mataKuliahId).localeCompare(kodeOf(b.mataKuliahId))
  })
}

export function groupKurikulumMappings<T extends { semesterKe: number | null }>(
  mappings: T[]
): Array<{ semesterKe: number | null; rows: T[] }> {
  const buckets = new Map<number | null, T[]>()
  for (const mapping of mappings) {
    const key = mapping.semesterKe
    const rows = buckets.get(key)
    if (rows) {
      rows.push(mapping)
    } else {
      buckets.set(key, [mapping])
    }
  }
  const keys = [...buckets.keys()].sort((a, b) => {
    if (a == null) {
      return 1
    }
    if (b == null) {
      return -1
    }
    return a - b
  })
  return keys.map((semesterKe) => ({ semesterKe, rows: buckets.get(semesterKe)! }))
}

export function unmappedMataKuliah<T extends { id: number }>(
  catalog: T[],
  mappings: Array<{ mataKuliahId: number; semester: string; semesterKe?: number | null }>,
  semester?: '' | 'Ganjil' | 'Genap',
  semesterKe?: number | null
): T[] {
  if (semester !== 'Ganjil' && semester !== 'Genap') {
    return catalog
  }
  const ke = semesterKe ?? null
  const taken = new Set(
    mappings
      .filter((mapping) => mapping.semester === semester && (mapping.semesterKe ?? null) === ke)
      .map((mapping) => mapping.mataKuliahId)
  )
  return catalog.filter((mataKuliah) => !taken.has(mataKuliah.id))
}
