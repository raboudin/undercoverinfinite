import { describe, expect, it, vi } from 'vitest'
import { createEntitlements, type EntitlementsResponse } from './useEntitlements'

const RESPONSE: EntitlementsResponse = {
  difficulties: [
    { id: 'evident', level: 1, label: 'Évident', tagline: 'Une association immédiate.' },
    { id: 'normal', level: 3, label: 'Normal', tagline: 'Assez proches pour bluffer.' },
    { id: 'farfelu', level: 5, label: 'Farfelu', tagline: 'Un lien indirect.' }
  ]
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body)
  } as Response
}

describe('createEntitlements', () => {
  it('relaie le catalogue de difficultés envoyé par le serveur', async () => {
    const request = vi.fn().mockResolvedValue(jsonResponse(RESPONSE))
    const entitlements = createEntitlements({ request })

    await entitlements.refresh()

    expect(entitlements.status.value).toBe('ready')
    expect(entitlements.difficultyCards.value).toEqual(RESPONSE.difficulties)
  })

  it('interroge la bonne route', async () => {
    const request = vi.fn().mockResolvedValue(jsonResponse(RESPONSE))
    const entitlements = createEntitlements({ request })

    await entitlements.refresh()

    expect(request).toHaveBeenCalledWith('/entitlements')
  })

  it('passe en erreur quand l’API refuse', async () => {
    const request = vi.fn().mockResolvedValue(jsonResponse({}, 500))
    const entitlements = createEntitlements({ request })

    await entitlements.refresh()

    expect(entitlements.status.value).toBe('error')
    expect(entitlements.ready.value).toBe(false)
  })

  it('survit à une API injoignable', async () => {
    const request = vi.fn().mockRejectedValue(new Error('offline'))
    const entitlements = createEntitlements({ request })

    await entitlements.refresh()

    expect(entitlements.status.value).toBe('error')
  })
})
