import type { Semester } from './api.ts'

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'] as const

export function semesterKeRoman(semesterKe: number | null | undefined): string {
  if (semesterKe == null) {
    return ''
  }
  return ROMAN[semesterKe - 1] ?? ''
}

export function semesterKeParityOk(semester: Semester, semesterKe: number): boolean {
  return semester === 'Ganjil' ? semesterKe % 2 === 1 : semesterKe % 2 === 0
}

export function semesterKeChoices(semester: Semester): number[] {
  return semester === 'Ganjil' ? [1, 3, 5, 7] : [2, 4, 6, 8]
}
