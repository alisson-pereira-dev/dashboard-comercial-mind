import { describe, expect, it } from 'vitest'
import { goalProgress, goalStatus } from './status'

describe('goalStatus', () => {
  it('abaixo da meta', () => {
    expect(goalStatus(50, 100)).toBe('abaixo')
  })
  it('na meta', () => {
    expect(goalStatus(100, 100)).toBe('na_meta')
    expect(goalStatus(95, 100)).toBe('na_meta')
  })
  it('acima da meta', () => {
    expect(goalStatus(110, 100)).toBe('acima')
  })
  it('sem meta cadastrada ou meta zero', () => {
    expect(goalStatus(10, null)).toBe('sem_meta')
    expect(goalStatus(10, 0)).toBe('sem_meta')
  })
})

describe('goalProgress', () => {
  it('retorna o percentual como fração', () => {
    expect(goalProgress(50, 200)).toBe(0.25)
  })
  it('retorna null sem meta', () => {
    expect(goalProgress(50, null)).toBeNull()
  })
})
