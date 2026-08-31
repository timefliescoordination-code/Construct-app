import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { getPublicAppOrigin } from './app-url.ts'

function fakeRequest(host: string) {
  return { headers: new Headers({ host }) }
}

describe('getPublicAppOrigin', () => {
  it('keeps localhost even when NEXT_PUBLIC_APP_URL points at production', () => {
    const previous = process.env.NEXT_PUBLIC_APP_URL
    process.env.NEXT_PUBLIC_APP_URL = 'https://vraconstruction.app'
    try {
      assert.equal(
        getPublicAppOrigin(fakeRequest('localhost:3000')),
        'http://localhost:3000',
      )
    } finally {
      if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_URL
      else process.env.NEXT_PUBLIC_APP_URL = previous
    }
  })
})
