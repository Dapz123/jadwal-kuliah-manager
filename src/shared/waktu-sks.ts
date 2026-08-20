import type { JenisKelas } from './api.ts'

/** Fixed per-SKS cut for Reguler Sore when Potongan Sore is aktif. */
export const POTONGAN_SORE_MENIT = 10

export function menitPerSks(input: {
  menit: number
  potonganSoreAktif: boolean
  jenisKelas: JenisKelas
}): number {
  if (input.potonganSoreAktif && input.jenisKelas === 'Reguler Sore') {
    return input.menit - POTONGAN_SORE_MENIT
  }
  return input.menit
}

export function jamSelesaiDariMulai(input: {
  jamMulai: number
  sks: number
  menit: number
  potonganSoreAktif: boolean
  jenisKelas: JenisKelas
}): number {
  return input.jamMulai + input.sks * menitPerSks(input)
}
