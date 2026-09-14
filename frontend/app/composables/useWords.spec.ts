import { describe, expect, it, vi } from 'vitest'
import { createWords } from './useWords'

const DRAW = {
  pair: { a: 'Café', b: 'Thé' }
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

    const result = await words.draw(false, 'normal')

    expect(request).toHaveBeenCalledWith('/words/draw', {
      method: 'POST',
      body: JSON.stringify({ theme: 'general', spicy: false, difficulty: 'normal' })
    })
    expect(result?.pair).toEqual({ a: 'Café', b: 'Thé' })
    expect(words.status.value).toBe('ready')
  })

  it('traite une panne du QG comme indisponibilité', async () => {
    const request = vi.fn().mockResolvedValue(jsonResponse({ message: 'LLM HS' }, 503))
    const words = createWords({ request })

    expect(await words.draw(false, 'normal')).toBeNull()
    expect(words.errorKind.value).toBe('unavailable')
    expect(words.error.value).toBe('LLM HS')
  })

  it('traite un thème inconnu comme indisponibilité', async () => {
    const request = vi.fn().mockResolvedValue(jsonResponse({ message: 'Thème inconnu.' }, 400))
    const words = createWords({ request })

    expect(await words.draw(false, 'normal')).toBeNull()
    expect(words.errorKind.value).toBe('unavailable')
  })

  it('traite une coupure réseau à part', async () => {
    const request = vi.fn().mockRejectedValue(new Error('offline'))
    const words = createWords({ request })

    expect(await words.draw(false, 'normal')).toBeNull()
    expect(words.errorKind.value).toBe('network')
    expect(words.status.value).toBe('error')
  })

  it('efface l’erreur précédente au tirage suivant', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ message: 'LLM HS' }, 503))
      .mockResolvedValueOnce(jsonResponse(DRAW))
    const words = createWords({ request })

    await words.draw(false, 'normal')
    await words.draw(false, 'normal')

    expect(words.error.value).toBeNull()
    expect(words.errorKind.value).toBeNull()
  })

  it('remet l’état à neuf', async () => {
    const request = vi.fn().mockResolvedValue(jsonResponse({}, 503))
    const words = createWords({ request })
    await words.draw(false, 'normal')

    words.reset()

    expect(words.status.value).toBe('idle')
    expect(words.error.value).toBeNull()
  })
})
