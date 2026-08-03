import { describe, expect, it, vi } from 'vitest'
import { createWords } from './useWords'

const CREDITS = {
  dailyLimit: 5,
  dailyUsed: 1,
  dailyRemaining: 4,
  wallet: 0,
  remaining: 4,
  unlimited: false,
  resetsOn: '2026-08-04'
}

const DRAW = {
  pair: { a: 'Café', b: 'Thé' },
  challenge: null,
  credits: CREDITS
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body)
  } as Response
}

describe('createWords', () => {
  it('demande les mots de la partie au serveur', async () => {
    const request = vi.fn().mockResolvedValue(jsonResponse(DRAW))
    const words = createWords({ request })

    const result = await words.draw('classique', 'football')

    expect(request).toHaveBeenCalledWith('/words/draw', {
      method: 'POST',
      body: JSON.stringify({ mode: 'classique', theme: 'football' })
    })
    expect(result?.pair).toEqual({ a: 'Café', b: 'Thé' })
    expect(words.status.value).toBe('ready')
  })

  it('rend le défi accompagnant une partie en mode défi', async () => {
    const request = vi
      .fn()
      .mockResolvedValue(jsonResponse({ ...DRAW, challenge: 'Utilise une couleur' }))
    const words = createWords({ request })

    const result = await words.draw('defi', 'general')

    expect(result?.challenge).toBe('Utilise une couleur')
  })

  it('renvoie les crédits à jour pour recaler l’affichage', async () => {
    const request = vi.fn().mockResolvedValue(jsonResponse(DRAW))
    const words = createWords({ request })

    const result = await words.draw('classique', 'general')

    expect(result?.credits.remaining).toBe(4)
  })

  it('distingue le quota épuisé (402) du mode verrouillé (403)', async () => {
    const outOfCredits = createWords({
      request: vi.fn().mockResolvedValue(jsonResponse({ message: 'Plus de parties' }, 402))
    })
    const locked = createWords({
      request: vi.fn().mockResolvedValue(jsonResponse({ message: 'Pack requis' }, 403))
    })

    expect(await outOfCredits.draw('classique', 'general')).toBeNull()
    expect(outOfCredits.errorKind.value).toBe('credits')
    expect(outOfCredits.error.value).toBe('Plus de parties')

    expect(await locked.draw('hot', 'general')).toBeNull()
    expect(locked.errorKind.value).toBe('locked')
  })

  it('traite une panne du QG comme indisponibilité', async () => {
    const request = vi.fn().mockResolvedValue(jsonResponse({ message: 'LLM HS' }, 503))
    const words = createWords({ request })

    expect(await words.draw('classique', 'general')).toBeNull()
    expect(words.errorKind.value).toBe('unavailable')
  })

  it('traite une coupure réseau à part', async () => {
    const request = vi.fn().mockRejectedValue(new Error('offline'))
    const words = createWords({ request })

    expect(await words.draw('classique', 'general')).toBeNull()
    expect(words.errorKind.value).toBe('network')
    expect(words.status.value).toBe('error')
  })

  it('efface l’erreur précédente au tirage suivant', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: 'Plus de parties' }, 402))
      .mockResolvedValueOnce(jsonResponse(DRAW))
    const words = createWords({ request })

    await words.draw('classique', 'general')
    await words.draw('classique', 'general')

    expect(words.error.value).toBeNull()
    expect(words.errorKind.value).toBeNull()
  })

  it('remet l’état à neuf', async () => {
    const request = vi.fn().mockResolvedValue(jsonResponse({}, 402))
    const words = createWords({ request })
    await words.draw('classique', 'general')

    words.reset()

    expect(words.status.value).toBe('idle')
    expect(words.error.value).toBeNull()
  })
})
