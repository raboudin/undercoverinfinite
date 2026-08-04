import { describe, expect, it, vi } from 'vitest'
import {
  createEntitlements,
  type Catalog,
  type EntitlementsResponse
} from './useEntitlements'

const CREDITS = {
  dailyLimit: 5,
  dailyUsed: 2,
  dailyRemaining: 3,
  wallet: 0,
  remaining: 3,
  unlimited: false,
  resetsOn: '2026-08-04'
}

const RIGHTS: EntitlementsResponse = {
  account: true,
  packs: ['discover'],
  modes: ['classique', 'chrono', 'hot'],
  themes: ['general', 'culture', 'nature', 'technologie'],
  credits: CREDITS
}

const CATALOG: Catalog = {
  packs: [
    {
      id: 'discover',
      label: 'Discover',
      tagline: '',
      priceEur: 3.59,
      modes: ['chrono', 'hot'],
      allThemes: false,
      unlimited: true,
      credits: 0
    },
    {
      id: 'infinite',
      label: 'Infinite',
      tagline: '',
      priceEur: 6.99,
      modes: ['chrono', 'hot', 'defi', 'teams', 'pari', 'diy'],
      allThemes: true,
      unlimited: true,
      credits: 0
    }
  ],
  modes: [
    { id: 'classique', label: 'Classique', tagline: '', available: true },
    { id: 'hot', label: 'Hot', tagline: '', available: true, spicy: true },
    { id: 'teams', label: 'Teams', tagline: '', available: false },
    { id: 'diy', label: 'DIY', tagline: '', available: true }
  ],
  themes: [
    { id: 'general', label: 'Tous horizons', tagline: '', generalist: true },
    { id: 'football', label: 'Football', tagline: '', generalist: false }
  ],
  freeDailyCredits: 5,
  unlimitedDailyCredits: 50
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body)
  } as Response
}

/** Répond selon le chemin appelé, comme le ferait l'API. */
function routedRequest(overrides: Record<string, Response> = {}) {
  return vi.fn((path: string) => {
    if (overrides[path]) return Promise.resolve(overrides[path])
    if (path === '/entitlements') return Promise.resolve(jsonResponse(RIGHTS))
    if (path === '/packs') return Promise.resolve(jsonResponse(CATALOG))
    return Promise.resolve(jsonResponse({}, 404))
  })
}

describe('createEntitlements', () => {
  it('relaie les droits envoyés par le serveur sans les recalculer', async () => {
    const entitlements = createEntitlements({ request: routedRequest() })

    await entitlements.refresh()

    expect(entitlements.status.value).toBe('ready')
    expect(entitlements.account.value).toBe(true)
    expect(entitlements.modes.value).toEqual(['classique', 'chrono', 'hot'])
    expect(entitlements.credits.value.remaining).toBe(3)
  })

  it('ne relit pas le catalogue à chaque rafraîchissement', async () => {
    const request = routedRequest()
    const entitlements = createEntitlements({ request })

    await entitlements.refresh()
    await entitlements.refresh()

    const packsCalls = request.mock.calls.filter(([path]) => path === '/packs')
    expect(packsCalls).toHaveLength(1)
  })

  it('marque comme verrouillé un mode absent des droits', async () => {
    const entitlements = createEntitlements({ request: routedRequest() })

    await entitlements.refresh()

    const diy = entitlements.modeCards.value.find(mode => mode.id === 'diy')
    expect(diy?.unlocked).toBe(false)
    expect(diy?.playable).toBe(false)
  })

  it('distingue « débloqué » de « jouable » pour un mode pas encore écrit', async () => {
    const request = routedRequest({
      '/entitlements': jsonResponse({
        ...RIGHTS,
        modes: ['classique', 'teams']
      })
    })
    const entitlements = createEntitlements({ request })

    await entitlements.refresh()

    const teams = entitlements.modeCards.value.find(mode => mode.id === 'teams')
    expect(teams?.unlocked).toBe(true)
    expect(teams?.playable).toBe(false)
  })

  it('marque les thèmes selon les droits reçus', async () => {
    const entitlements = createEntitlements({ request: routedRequest() })

    await entitlements.refresh()

    expect(entitlements.themeCards.value).toEqual([
      { id: 'general', label: 'Tous horizons', tagline: '', generalist: true, unlocked: true },
      { id: 'football', label: 'Football', tagline: '', generalist: false, unlocked: false }
    ])
  })

  it('marque les packs déjà rattachés au dossier', async () => {
    const entitlements = createEntitlements({ request: routedRequest() })

    await entitlements.refresh()

    const owned = entitlements.packCards.value.map(pack => [pack.id, pack.owned])
    expect(owned).toEqual([
      ['discover', true],
      ['infinite', false]
    ])
  })

  it('passe en erreur quand l’API refuse, sans inventer de crédits', async () => {
    const request = routedRequest({ '/entitlements': jsonResponse({}, 500) })
    const entitlements = createEntitlements({ request })

    await entitlements.refresh()

    expect(entitlements.status.value).toBe('error')
    expect(entitlements.credits.value.remaining).toBe(0)
    expect(entitlements.canPlay.value).toBe(false)
  })

  it('survit à une API injoignable', async () => {
    const request = vi.fn().mockRejectedValue(new Error('offline'))
    const entitlements = createEntitlements({ request })

    await entitlements.refresh()

    expect(entitlements.status.value).toBe('error')
  })

  it('interdit de lancer une partie sans crédit restant', async () => {
    const request = routedRequest({
      '/entitlements': jsonResponse({
        ...RIGHTS,
        credits: { ...CREDITS, dailyRemaining: 0, remaining: 0 }
      })
    })
    const entitlements = createEntitlements({ request })

    await entitlements.refresh()

    expect(entitlements.canPlay.value).toBe(false)
  })

  it('recale le solde depuis la réponse du tirage', async () => {
    const entitlements = createEntitlements({ request: routedRequest() })
    await entitlements.refresh()

    entitlements.applyCredits({ ...CREDITS, dailyUsed: 3, dailyRemaining: 2, remaining: 2 })

    expect(entitlements.credits.value.remaining).toBe(2)
  })

  describe('unlock', () => {
    it('applique les droits renvoyés par le déblocage', async () => {
      const request = routedRequest({
        '/packs/infinite/unlock': jsonResponse({
          ...RIGHTS,
          packs: ['discover', 'infinite'],
          modes: ['classique', 'chrono', 'hot', 'defi', 'teams', 'pari', 'diy']
        })
      })
      const entitlements = createEntitlements({ request })
      await entitlements.refresh()

      const ok = await entitlements.unlock('infinite')

      expect(ok).toBe(true)
      expect(entitlements.packs.value).toContain('infinite')
      expect(entitlements.modes.value).toContain('diy')
    })

    it('remonte le message de l’API en cas de refus', async () => {
      const request = routedRequest({
        '/packs/infinite/unlock': jsonResponse(
          { message: 'Le pack Infinite est déjà rattaché à ton dossier.' },
          409
        )
      })
      const entitlements = createEntitlements({ request })

      const ok = await entitlements.unlock('infinite')

      expect(ok).toBe(false)
      expect(entitlements.error.value).toMatch(/déjà rattaché/)
    })

    it('poste bien sur la route de déblocage', async () => {
      const request = routedRequest({
        '/packs/diamond/unlock': jsonResponse(RIGHTS)
      })
      const entitlements = createEntitlements({ request })

      await entitlements.unlock('diamond')

      expect(request).toHaveBeenCalledWith('/packs/diamond/unlock', { method: 'POST' })
    })
  })
})
