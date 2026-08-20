export function dosenNamaLengkap(dosen: {
  nama: string
  gelarDepan: string | null
  gelarBelakang: string | null
}): string {
  return [dosen.gelarDepan, dosen.nama, dosen.gelarBelakang].filter(Boolean).join(' ')
}
