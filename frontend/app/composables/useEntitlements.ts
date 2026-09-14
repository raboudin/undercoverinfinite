import { computed, ref } from 'vue'

export type DifficultyId = 'evident' | 'facile' | 'normal' | 'difficile' | 'farfelu'

export interface DifficultyCard {
  id: DifficultyId
  /** 1 (évident) à 5 (farfelu). */
  level: number
  label: string
  tagline: string
}

export interface EntitlementsResponse {
  difficulties: DifficultyCard[]
}

export type EntitlementsStatus = 'idle' | 'loading' | 'ready' | 'error'

/**
 * Niveaux de difficulté disponibles — le jeu est entièrement gratuit, cette
 * réponse est identique pour tous. Le thème est fixé à `general` côté front.
 *
 * `request` est injecté plutôt que reconstruit, même schéma que
 * `useWords`/`useRoomSocket` : le plugin passe l'`authFetch` de `useAuth`.
 */
export function createEntitlements(options: {
  request: (path: string, init?: RequestInit) => Promise<Response>
}) {
  const status = ref<EntitlementsStatus>('idle')
  const difficultyCards = ref<DifficultyCard[]>([])

  const ready = computed(() => status.value === 'ready')

  async function refresh(): Promise<void> {
    if (status.value === 'idle') status.value = 'loading'
    try {
      const res = await options.request('/entitlements')
      if (!res.ok) {
        status.value = 'error'
        return
      }
      const data = (await res.json()) as EntitlementsResponse
      difficultyCards.value = data.difficulties
      status.value = 'ready'
    }
    catch {
      status.value = 'error'
    }
  }

  return {
    status,
    difficultyCards,
    ready,
    refresh
  }
}

export type Entitlements = ReturnType<typeof createEntitlements>
