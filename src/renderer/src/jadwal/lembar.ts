import type { JadwalSnapshot, Kelas } from '../../../shared/api.ts'

export type LembarGapStatus = 'missing' | 'belum hari' | 'belum jam'

export type LembarSideRow = {
  snapshotMkId: number
  kode: string
  nama: string
  sks: number
  status: LembarGapStatus | null
  hari: number | null
}

function isWeekend(hari: number | null): boolean {
  return hari === 6 || hari === 7
}

function isWeekdayPlaceable(kelas: Kelas | undefined): boolean {
  return (
    kelas != null &&
    kelas.hari != null &&
    kelas.hari >= 1 &&
    kelas.hari <= 5 &&
    kelas.jamMulai != null
  )
}

export function lembarGapStatus(kelas: Kelas | undefined): LembarGapStatus {
  if (kelas == null) {
    return 'missing'
  }
  if (kelas.hari == null) {
    return 'belum hari'
  }
  return 'belum jam'
}

/** Snapshot rows that are not on the Senin–Jumat packed sheet (and not weekend Kelas). */
export function lembarWeekdayGaps(
  snapshots: readonly JadwalSnapshot[],
  kelas: readonly Kelas[]
): LembarSideRow[] {
  const bySnapshot = new Map(kelas.map((row) => [row.snapshotMkId, row]))
  const rows: LembarSideRow[] = []
  for (const snapshot of snapshots) {
    const row = bySnapshot.get(snapshot.id)
    if (row != null && isWeekend(row.hari)) {
      continue
    }
    if (isWeekdayPlaceable(row)) {
      continue
    }
    rows.push({
      snapshotMkId: snapshot.id,
      kode: snapshot.kode,
      nama: snapshot.nama,
      sks: snapshot.sks,
      status: lembarGapStatus(row),
      hari: row?.hari ?? null
    })
  }
  return rows
}

/** Kelas on Sabtu/Minggu (omitted from the weekday lembar). */
export function lembarWeekendRows(
  snapshots: readonly JadwalSnapshot[],
  kelas: readonly Kelas[]
): LembarSideRow[] {
  const byId = new Map(snapshots.map((row) => [row.id, row]))
  const rows: LembarSideRow[] = []
  for (const row of kelas) {
    if (!isWeekend(row.hari)) {
      continue
    }
    const snapshot = byId.get(row.snapshotMkId)
    if (snapshot == null) {
      continue
    }
    rows.push({
      snapshotMkId: snapshot.id,
      kode: snapshot.kode,
      nama: snapshot.nama,
      sks: snapshot.sks,
      status: null,
      hari: row.hari
    })
  }
  return rows
}
