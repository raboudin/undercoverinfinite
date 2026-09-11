import { ref } from 'vue'
import type { DifficultyId, ThemeId } from './useEntitlements'
import type { WordPair } from './useGame'

export type WordsStatus = 'idle' | 'drawing' | 'ready' | 'error'

export type WordsErrorKind = 'unavailable' | 'network'

export interface DrawResponse {
  pair: WordPair
}

const GENERIC_ERROR = 'Le QG ne répond pas. Réessaie dans un instant.'

/**
 * Tirage des mots d'une partie (`POST /words/draw`).
 *
 * Chaque partie demande ses mots au serveur, qui choisit la paire selon le
 * thème, le registre (hot) et la difficulté demandés — le jeu est gratuit,
 * il n'y a donc plus de crédit ni de verrou à gérer côté client.
 */
export function createWords(options: {
  request: (path: string, init?: RequestInit) => Promise<Response>
}) {
  const status = ref<WordsStatus>('idle')
  const error = ref<string | null>(null)
  const errorKind = ref<WordsErrorKind | null>(null)

  function fail(kind: WordsErrorKind, message: string): null {
    status.value = 'error'
    errorKind.value = kind
    error.value = message
    return null
  }

  async function messageOf(response: Response): Promise<string> {
    try {
      const body = (await response.json()) as { message?: string | string[] }
      const message = Array.isArray(body.message) ? body.message[0] : body.message
      return message ?? GENERIC_ERROR
    }
    catch {
      return GENERIC_ERROR
    }
  }

  /**
   * Demande les mots d'une partie. Rend `null` en cas d'échec : l'appelant ne
   * doit surtout pas démarrer la partie.
   */
  async function draw(theme: ThemeId, spicy: boolean, difficulty: DifficultyId): Promise<DrawResponse | null> {
    status.value = 'drawing'
    error.value = null
    errorKind.value = null

    let response: Response
    try {
      response = await options.request('/words/draw', {
        method: 'POST',
        body: JSON.stringify({ theme, spicy, difficulty })
      })
    }
    catch {
      return fail('network', GENERIC_ERROR)
    }

    if (!response.ok) {
      const message = await messageOf(response)
      return fail('unavailable', message)
    }

    try {
      const data = (await response.json()) as DrawResponse
      status.value = 'ready'
      return data
    }
    catch {
      return fail('unavailable', GENERIC_ERROR)
    }
  }

  function reset(): void {
    status.value = 'idle'
    error.value = null
    errorKind.value = null
  }

  return { status, error, errorKind, draw, reset }
}

export type Words = ReturnType<typeof createWords>
