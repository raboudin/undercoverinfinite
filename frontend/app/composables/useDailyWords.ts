import { computed, ref } from 'vue'
import type { WordPair } from './useGame'

export type DailyWordsStatus = 'idle' | 'loading' | 'ready' | 'error'

export interface DailyWordsResponse {
  day: string
  pairs: WordPair[]
}

/**
 * Suivi de consommation en localStorage : le lot est global (même 5 paires
 * pour tout le monde), seul le compteur d'usage est propre à l'appareil.
 * Pas de sécurité particulière voulue — les crédits sont gratuits.
 */
const STORAGE_KEY = 'undercover:daily-words'

interface StoredUsage {
  day: string
  used: number
}

/**
 * Crédits de mots du jour, servis par l'API (`GET /words/today`).
 *
 * Factory comme `createGame` : les tests injectent `fetchFn`/`storage`, l'app
 * l'instancie une fois dans la page avec l'`apiBase` du runtime config.
 * Les paires sont consommées dans l'ordre du lot, une par partie — le
 * compteur repart à zéro quand le jour renvoyé par l'API change.
 */
export function createDailyWords(options: {
  apiBase: string
  fetchFn?: typeof fetch
  storage?: Pick<Storage, 'getItem' | 'setItem'>
}) {
  const fetchFn = options.fetchFn ?? ((input, init) => fetch(input, init))
  const storage
    = options.storage ?? (typeof localStorage !== 'undefined' ? localStorage : undefined)

  const status = ref<DailyWordsStatus>('idle')
  const day = ref<string | null>(null)
  const pairs = ref<WordPair[]>([])
  const used = ref(0)

  const remaining = computed(() => Math.max(pairs.value.length - used.value, 0))
  const total = computed(() => pairs.value.length)
  const exhausted = computed(() => status.value === 'ready' && remaining.value === 0)

  /** Paire que consommera la prochaine partie — sans la consommer. */
  const nextPair = computed<WordPair | null>(() => pairs.value[used.value] ?? null)

  function readUsage(forDay: string): number {
    try {
      const raw = storage?.getItem(STORAGE_KEY)
      if (!raw) return 0
      const stored = JSON.parse(raw) as StoredUsage
      return stored.day === forDay && Number.isInteger(stored.used) && stored.used > 0
        ? stored.used
        : 0
    }
    catch {
      return 0
    }
  }

  function persist() {
    if (!day.value) return
    storage?.setItem(STORAGE_KEY, JSON.stringify({ day: day.value, used: used.value }))
  }

  async function refresh() {
    status.value = 'loading'
    try {
      const response = await fetchFn(`${options.apiBase}/words/today`)
      if (!response.ok) throw new Error(`API ${response.status}`)
      const data = (await response.json()) as DailyWordsResponse
      day.value = data.day
      pairs.value = data.pairs
      used.value = readUsage(data.day)
      status.value = 'ready'
    }
    catch {
      status.value = 'error'
    }
  }

  /**
   * Consomme un crédit et rend la paire correspondante. À n'appeler qu'une
   * fois la partie réellement lancée : une config invalide ne coûte rien.
   */
  function consume(): WordPair | null {
    const pair = nextPair.value
    if (!pair) return null
    used.value += 1
    persist()
    return pair
  }

  return {
    status,
    day,
    pairs,
    used,
    remaining,
    total,
    exhausted,
    nextPair,
    refresh,
    consume
  }
}

export type DailyWords = ReturnType<typeof createDailyWords>
