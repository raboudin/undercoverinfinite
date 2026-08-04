import { ref } from 'vue'
import type { Credits, ModeId, ThemeId } from './useEntitlements'
import type { WordPair } from './useGame'

export type WordsStatus = 'idle' | 'drawing' | 'ready' | 'error'

/**
 * Pourquoi le tirage a échoué. Le message seul ne suffit pas : l'écran propose
 * la boutique pour `locked`, une explication d'attente pour `credits`, et un
 * simple « réessaie » pour le reste.
 */
export type WordsErrorKind = 'credits' | 'locked' | 'unavailable' | 'network'

export interface DrawResponse {
  pair: WordPair
  /** Rempli seulement en mode défi. */
  challenge: string | null
  credits: Credits
}

const GENERIC_ERROR = 'Le QG ne répond pas. Réessaie dans un instant.'

/**
 * Tirage des mots d'une partie (`POST /words/draw`).
 *
 * Le lot quotidien a disparu : chaque partie demande ses mots au serveur, qui
 * débite le crédit et choisit la paire. Le client ne compte donc plus rien
 * lui-même — c'est ce qui permet à un même compte de retrouver ses crédits
 * d'un appareil à l'autre.
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
   * doit surtout pas démarrer la partie, le crédit n'ayant pas été débité.
   */
  async function draw(mode: ModeId, theme: ThemeId): Promise<DrawResponse | null> {
    status.value = 'drawing'
    error.value = null
    errorKind.value = null

    let response: Response
    try {
      response = await options.request('/words/draw', {
        method: 'POST',
        body: JSON.stringify({ mode, theme })
      })
    }
    catch {
      return fail('network', GENERIC_ERROR)
    }

    if (!response.ok) {
      const message = await messageOf(response)
      // 402 : plus de crédit ; 403 : mode ou thème verrouillé. Deux impasses
      // très différentes pour le joueur, d'où deux issues distinctes.
      if (response.status === 402) return fail('credits', message)
      if (response.status === 403) return fail('locked', message)
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
