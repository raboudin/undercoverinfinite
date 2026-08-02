import { describe, expect, it, vi } from 'vitest'
import { createDailyWords } from './useDailyWords'

const PAIRS = [
  { a: 'Café', b: 'Thé' },
  { a: 'Avion', b: 'Hélicoptère' },
  { a: 'Chien', b: 'Loup' },
  { a: 'Passeport', b: 'Visa' },
  { a: 'Valise', b: 'Sac à dos' }
]

function okResponse(body: unknown): Response {
  return { ok: true, json: () => Promise.resolve(body) } as Response
}

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    dump: () => Object.fromEntries(data)
  }
}

function makeWords(overrides: Partial<Parameters<typeof createDailyWords>[0]> = {}) {
  return createDailyWords({
    apiBase: 'http://api.test',
    fetchFn: vi.fn().mockResolvedValue(okResponse({ day: '2026-08-02', pairs: PAIRS })),
    storage: memoryStorage(),
    ...overrides
  })
}

describe('createDailyWords', () => {
  it('charge le lot du jour et expose 5 crédits', async () => {
    const fetchFn = vi.fn().mockResolvedValue(okResponse({ day: '2026-08-02', pairs: PAIRS }))
    const words = makeWords({ fetchFn })

    expect(words.status.value).toBe('idle')
    await words.refresh()

    expect(fetchFn).toHaveBeenCalledWith('http://api.test/words/today')
    expect(words.status.value).toBe('ready')
    expect(words.day.value).toBe('2026-08-02')
    expect(words.remaining.value).toBe(5)
    expect(words.exhausted.value).toBe(false)
  })

  it('consomme les paires dans l’ordre et persiste le compteur', async () => {
    const storage = memoryStorage()
    const words = makeWords({ storage })
    await words.refresh()

    expect(words.consume()).toEqual(PAIRS[0])
    expect(words.consume()).toEqual(PAIRS[1])
    expect(words.remaining.value).toBe(3)
    expect(JSON.parse(storage.dump()['undercover:daily-words']!)).toEqual({
      day: '2026-08-02',
      used: 2
    })
  })

  it('retrouve la consommation du jour depuis le storage', async () => {
    const storage = memoryStorage({
      'undercover:daily-words': JSON.stringify({ day: '2026-08-02', used: 4 })
    })
    const words = makeWords({ storage })
    await words.refresh()

    expect(words.remaining.value).toBe(1)
    expect(words.nextPair.value).toEqual(PAIRS[4])
  })

  it('repart à zéro quand le jour de l’API change', async () => {
    const storage = memoryStorage({
      'undercover:daily-words': JSON.stringify({ day: '2026-08-01', used: 5 })
    })
    const words = makeWords({ storage })
    await words.refresh()

    expect(words.remaining.value).toBe(5)
  })

  it('bloque à zéro crédit : exhausted, plus de paire à consommer', async () => {
    const storage = memoryStorage({
      'undercover:daily-words': JSON.stringify({ day: '2026-08-02', used: 5 })
    })
    const words = makeWords({ storage })
    await words.refresh()

    expect(words.remaining.value).toBe(0)
    expect(words.exhausted.value).toBe(true)
    expect(words.nextPair.value).toBeNull()
    expect(words.consume()).toBeNull()
  })

  it('passe en erreur quand l’API est injoignable ou en panne', async () => {
    const down = makeWords({ fetchFn: vi.fn().mockRejectedValue(new Error('réseau')) })
    await down.refresh()
    expect(down.status.value).toBe('error')

    const broken = makeWords({
      fetchFn: vi.fn().mockResolvedValue({ ok: false, status: 503 } as Response)
    })
    await broken.refresh()
    expect(broken.status.value).toBe('error')
    expect(broken.exhausted.value).toBe(false)
  })

  it('ignore un storage corrompu', async () => {
    const storage = memoryStorage({ 'undercover:daily-words': '{pas du json' })
    const words = makeWords({ storage })
    await words.refresh()
    expect(words.remaining.value).toBe(5)
  })
})
