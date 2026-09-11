import { computed, ref } from 'vue'

export type ThemeId
  = 'general' | 'culture' | 'nature' | 'technologie'
    | 'personnalites' | 'pop-culture' | 'football' | 'pays-etats' | 'histoire-arts'

export type DifficultyId = 'evident' | 'facile' | 'normal' | 'difficile' | 'farfelu'

export interface ThemeCard {
  id: ThemeId
  label: string
  /** Accroche de vitrine, servie par le catalogue — le front n'en invente pas. */
  tagline: string
}

export interface DifficultyCard {
  id: DifficultyId
  /** 1 (évident) à 5 (farfelu). */
  level: number
  label: string
  tagline: string
}

export interface EntitlementsResponse {
  themes: ThemeCard[]
  difficulties: DifficultyCard[]
}

export type EntitlementsStatus = 'idle' | 'loading' | 'ready' | 'error'

/**
 * Thèmes et paliers de difficulté disponibles — le jeu est entièrement
 * gratuit, il n'y a donc plus de notion de droits par joueur : cette réponse
 * est la même pour tout le monde.
 *
 * **Aucune copie n'est dupliquée ici.** Le serveur envoie les libellés et
 * accroches, ce composable ne fait que les relayer : c'est ce qui garantit
 * qu'un changement de contenu côté API ne laisse pas une interface qui
 * affiche autre chose.
 *
 * `request` est injecté plutôt que reconstruit, même schéma que
 * `useWords`/`useRoomSocket` : le plugin passe l'`authFetch` de `useAuth`.
 */
export function createEntitlements(options: {
  request: (path: string, init?: RequestInit) => Promise<Response>
}) {
  const status = ref<EntitlementsStatus>('idle')
  const themeCards = ref<ThemeCard[]>([])
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
      themeCards.value = data.themes
      difficultyCards.value = data.difficulties
      status.value = 'ready'
    }
    catch {
      status.value = 'error'
    }
  }

  return {
    status,
    themeCards,
    difficultyCards,
    ready,
    refresh
  }
}

export type Entitlements = ReturnType<typeof createEntitlements>
