import type { Bentrok } from '../../../shared/api.ts'
import { countWeekendKelas, exportBanner } from '../../../shared/export-grid.ts'
import { joinBentrok, kelengkapan, kelengkapanBanner } from '../jadwal/jadwal.ts'

export function exportCompletenessBanner(
  snapshots: Array<{ id: number }>,
  kelas: Array<{
    id: number
    snapshotMkId: number
    dosenId: number | null
    hari: number | null
    jamMulai: number | null
  }>,
  bentrok: Bentrok[] | null
): string | null {
  const kelasBySnapshot = new Map(kelas.map((row) => [row.snapshotMkId, row]))
  let missing = 0
  let incomplete = 0
  for (const snapshot of snapshots) {
    const mark = kelengkapan(kelasBySnapshot.get(snapshot.id) ?? null)
    if (mark === 'missing') {
      missing += 1
    } else if (mark === 'incomplete') {
      incomplete += 1
    }
  }
  if (bentrok == null && missing === 0 && incomplete === 0) {
    return null
  }
  return exportBanner(
    kelengkapanBanner({
      missing,
      incomplete,
      bentrok: joinBentrok(kelas, bentrok ?? []).bentrokCount
    }),
    countWeekendKelas(kelas)
  )
}
