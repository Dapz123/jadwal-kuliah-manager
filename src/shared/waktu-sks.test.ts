import assert from 'node:assert/strict'
import { test } from 'node:test'
import { jamSelesaiDariMulai, menitPerSks, POTONGAN_SORE_MENIT } from './waktu-sks.ts'

test('Pagi always uses full Waktu SKS even when Potongan Sore is aktif', () => {
  assert.equal(
    menitPerSks({ menit: 50, potonganSoreAktif: true, jenisKelas: 'Reguler Pagi' }),
    50
  )
})

test('Sore subtracts fixed potongan per SKS when aktif', () => {
  assert.equal(POTONGAN_SORE_MENIT, 10)
  assert.equal(
    menitPerSks({ menit: 50, potonganSoreAktif: true, jenisKelas: 'Reguler Sore' }),
    40
  )
})

test('Sore uses full Waktu SKS when Potongan Sore is nonaktif', () => {
  assert.equal(
    menitPerSks({ menit: 50, potonganSoreAktif: false, jenisKelas: 'Reguler Sore' }),
    50
  )
})

test('jam selesai for 3 SKS Sore with potongan is mulai plus 3 times (menit - 10)', () => {
  assert.equal(
    jamSelesaiDariMulai({
      jamMulai: 960,
      sks: 3,
      menit: 50,
      potonganSoreAktif: true,
      jenisKelas: 'Reguler Sore'
    }),
    1080
  )
})
