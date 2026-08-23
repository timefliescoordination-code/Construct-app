import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { mergeAuthCookieOptions } from './session-cookies.ts'

describe('mergeAuthCookieOptions', () => {
  it('defaults path to / for site-wide session cookies', () => {
    assert.equal(mergeAuthCookieOptions().path, '/')
  })

  it('forces path / even when provider passes API-scoped path', () => {
    assert.equal(mergeAuthCookieOptions({ path: '/api/auth/login' }).path, '/')
  })

  it('preserves maxAge from provider options', () => {
    assert.equal(mergeAuthCookieOptions({ maxAge: 3600 }).maxAge, 3600)
    assert.equal(mergeAuthCookieOptions({ maxAge: 3600 }).path, '/')
  })
})
