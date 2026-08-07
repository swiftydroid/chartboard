import { describe, expect, it } from 'vitest'
import { isProtectedPath } from './route-protection'

describe('isProtectedPath', () => {
  it('matches the exact protected path', () => {
    expect(isProtectedPath('/dashboard')).toBe(true)
  })

  it('matches a nested path under a protected prefix', () => {
    expect(isProtectedPath('/dashboard/settings')).toBe(true)
  })

  it('does not match an unrelated path that merely starts with the same letters', () => {
    expect(isProtectedPath('/dashboard-old')).toBe(false)
  })

  it('does not match the login page', () => {
    expect(isProtectedPath('/login')).toBe(false)
  })

  it('does not match the root path', () => {
    expect(isProtectedPath('/')).toBe(false)
  })
})
