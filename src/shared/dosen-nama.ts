type DosenNama = {
  nama: string
  gelarDepan: string | null
  gelarBelakang: string | null
}

export type DosenNamaLembar = {
  nama: string
  unknownGelar: string[]
}

export function dosenNamaLengkap(dosen: DosenNama): string {
  return [dosen.gelarDepan, dosen.nama, dosen.gelarBelakang].filter(Boolean).join(' ')
}

/** Export XLSX only: comma before gelar belakang. UI stays `dosenNamaLengkap`. */
export function dosenNamaExport(dosen: DosenNama): string {
  const depan = dosen.gelarDepan?.trim() ?? ''
  const nama = dosen.nama.trim()
  const belakang = dosen.gelarBelakang?.trim() ?? ''
  const head = [depan, nama].filter(Boolean).join(' ')
  return belakang === '' ? head : `${head}, ${belakang}`
}

/** Lembar Jadwal: trim gelar belakang to the highest (two highest when there are exactly 3). */
export function dosenNamaLembar(dosen: DosenNama): DosenNamaLembar {
  const trimmed = trimGelarBelakang(dosen.gelarBelakang)
  return {
    nama: dosenNamaExport({ ...dosen, gelarBelakang: trimmed.value }),
    unknownGelar: trimmed.unknown
  }
}

export function gelarExportWarning(items: readonly string[]): string | null {
  if (items.length === 0) {
    return null
  }
  return `Gelar tidak dikenali (nama tidak dipangkas): ${items.join('; ')}`
}

export function gelarWarningItem(nama: string, unknownGelar: readonly string[]): string {
  return `${nama.trim()} (${unknownGelar.join(', ')})`
}

function trimGelarBelakang(raw: string | null): { value: string | null; unknown: string[] } {
  const text = raw?.trim() ?? ''
  if (text === '') {
    return { value: null, unknown: [] }
  }
  const tokens = text
    .split(',')
    .map((token) => token.trim())
    .filter((token) => token !== '')
  if (tokens.length === 0) {
    return { value: null, unknown: [] }
  }
  const unknown = tokens.filter((token) => gelarRank(token) == null)
  if (unknown.length > 0) {
    return { value: text, unknown }
  }
  const keep = tokens.length === 3 ? 2 : 1
  return { value: pickHighest(tokens, keep).join(', '), unknown: [] }
}

/** Higher number = higher academic gelar. Null = unrecognized. */
function gelarRank(token: string): number | null {
  const key = token.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (key === '' || key === 'prof') {
    return null
  }
  if (key === 'drs' || key === 'dra') {
    return 1
  }
  if (
    key === 'dr' ||
    key.startsWith('phd') ||
    key.startsWith('dring') ||
    key.startsWith('drrer') ||
    key.startsWith('drphil') ||
    key === 'edd' ||
    key === 'dsc'
  ) {
    return 5
  }
  if (key.startsWith('sp')) {
    return 4
  }
  if (key === 'ir' || key === 'apt' || key === 'ak') {
    return 2
  }
  if (key.startsWith('m')) {
    return 3
  }
  if (key.startsWith('s') || key.startsWith('amd') || key.startsWith('b') || key === 'lc') {
    return 1
  }
  return null
}

function pickHighest(tokens: string[], keep: number): string[] {
  return tokens
    .map((token, index) => ({ token, index, rank: gelarRank(token) ?? 0 }))
    .sort((a, b) => b.rank - a.rank || b.index - a.index)
    .slice(0, keep)
    .sort((a, b) => a.index - b.index)
    .map((row) => row.token)
}
