import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  semesterKeChoices,
  semesterKeParityOk,
  semesterKeRoman
} from './semester-ke.ts'

test('Semester ke Roman is I through VIII and blank when missing', () => {
  assert.equal(semesterKeRoman(null), '')
  assert.equal(semesterKeRoman(1), 'I')
  assert.equal(semesterKeRoman(2), 'II')
  assert.equal(semesterKeRoman(3), 'III')
  assert.equal(semesterKeRoman(4), 'IV')
  assert.equal(semesterKeRoman(5), 'V')
  assert.equal(semesterKeRoman(6), 'VI')
  assert.equal(semesterKeRoman(7), 'VII')
  assert.equal(semesterKeRoman(8), 'VIII')
})

test('Semester ke parity matches Ganjil odd and Genap even', () => {
  assert.equal(semesterKeParityOk('Ganjil', 1), true)
  assert.equal(semesterKeParityOk('Ganjil', 2), false)
  assert.equal(semesterKeParityOk('Genap', 2), true)
  assert.equal(semesterKeParityOk('Genap', 3), false)
})

test('Semester ke choices follow Semester parity', () => {
  assert.deepEqual(semesterKeChoices('Ganjil'), [1, 3, 5, 7])
  assert.deepEqual(semesterKeChoices('Genap'), [2, 4, 6, 8])
})
