import { describe, expect, it } from 'vitest'
import { canEditChart } from './permissions'

describe('canEditChart', () => {
  it('allows the owner', () => {
    expect(canEditChart({ owner_id: 'user-1' }, 'user-1', false)).toBe(true)
  })

  it('denies a non-owner on a chart that has an owner', () => {
    expect(canEditChart({ owner_id: 'user-1' }, 'user-2', false)).toBe(false)
  })

  it('denies a non-admin on an ownerless chart', () => {
    expect(canEditChart({ owner_id: null }, 'user-2', false)).toBe(false)
  })

  it('allows an admin on an ownerless chart', () => {
    expect(canEditChart({ owner_id: null }, 'user-2', true)).toBe(true)
  })

  it('denies an admin on a chart that still has a different owner', () => {
    expect(canEditChart({ owner_id: 'user-1' }, 'user-2', true)).toBe(false)
  })
})
