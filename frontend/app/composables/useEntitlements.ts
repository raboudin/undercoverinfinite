import { computed, ref } from 'vue'

export type ModeId
  = 'classique' | 'chrono' | 'hot' | 'defi' | 'teams' | 'pari'

export type ThemeId
  = 'general' | 'culture' | 'nature' | 'technologie'
    | 'personnalites' | 'pop-culture' | 'football' | 'pays-etats' | 'histoire-arts'

export type PackId = 'credits20' | 'unlimited' | 'discover' | 'diamond' | 'infinite'

export interface Credits {
  dailyLimit: number
  dailyUsed: number
  dailyRemaining: number
  /** Solde acheté, sans péremption. Toujours 0 sans compte. */
  wallet: number
  /** Ce que le joueur peut réellement lancer maintenant. */
  remaining: number
  unlimited: boolean
  resetsOn: string
}

export interface EntitlementsResponse {
  account: boolean
  packs: PackId[]
  modes: ModeId[]
  themes: ThemeId[]
  credits: Credits
}

export interface ModeDefinition {
  id: ModeId
  label: string
  tagline: string
  /** `false` = vendu mais pas encore jouable (cf. teams). */
  available: boolean
  spicy?: boolean
}

export interface ThemeDefinition {
  id: ThemeId
  label: string
  /** Accroche de vitrine, servie par le catalogue — le front n'en invente pas. */
  tagline: string
  generalist: boolean
}

/** Mode du catalogue, enrichi de l'état de déblocage du demandeur. */
export interface ModeCard extends ModeDefinition {
  unlocked: boolean
  /** Jouable = débloqué **et** implémenté. */
  playable: boolean
}

export interface ThemeCard extends ThemeDefinition {
  unlocked: boolean
}

export interface PackDefinition {
  id: PackId
  label: string
  tagline: string
  priceEur: number
  modes: ModeId[]
  allThemes: boolean
  unlimited: boolean
  credits: number
}

export interface Catalog {
  packs: PackDefinition[]
  modes: ModeDefinition[]
  themes: ThemeDefinition[]
  freeDailyCredits: number
  unlimitedDailyCredits: number
}

export type EntitlementsStatus = 'idle' | 'loading' | 'ready' | 'error'

const GENERIC_ERROR = 'Le QG ne répond pas. Réessaie dans un instant.'

/** Crédits neutres tant que l'API n'a pas répondu — jamais affichés comme un vrai solde. */
const UNKNOWN_CREDITS: Credits = {
  dailyLimit: 0,
  dailyUsed: 0,
  dailyRemaining: 0,
  wallet: 0,
  remaining: 0,
  unlimited: false,
  resetsOn: ''
}

/**
 * Droits du joueur : modes ouverts, thèmes ouverts, crédits restants.
 *
 * **Aucune règle de pack n'est rejouée ici.** Le serveur envoie la liste des
 * modes et des thèmes autorisés, ce composable ne fait que la relayer : c'est
 * ce qui garantit qu'un changement de barème côté API ne laisse pas une
 * interface qui promet autre chose. Les définitions (libellés, prix) viennent
 * du même catalogue serveur.
 *
 * `request` est injecté plutôt que reconstruit : le plugin passe l'`authFetch`
 * de `useAuth`, qui sait rejouer une requête après rotation du token. Sans ça,
 * un `POST /packs/:id/unlock` échouerait bêtement sur un access token expiré.
 */
export function createEntitlements(options: {
  request: (path: string, init?: RequestInit) => Promise<Response>
}) {
  const status = ref<EntitlementsStatus>('idle')
  const account = ref(false)
  const packs = ref<PackId[]>([])
  const modes = ref<ModeId[]>([])
  const themes = ref<ThemeId[]>([])
  const credits = ref<Credits>({ ...UNKNOWN_CREDITS })
  const catalog = ref<Catalog | null>(null)
  const pending = ref(false)
  const error = ref<string | null>(null)

  const ready = computed(() => status.value === 'ready')
  const canPlay = computed(() => ready.value && credits.value.remaining > 0)

  /** Modes du catalogue enrichis de leur état de déblocage, ordre serveur. */
  const modeCards = computed<ModeCard[]>(() =>
    (catalog.value?.modes ?? []).map(mode => ({
      ...mode,
      unlocked: modes.value.includes(mode.id),
      playable: modes.value.includes(mode.id) && mode.available
    }))
  )

  const themeCards = computed<ThemeCard[]>(() =>
    (catalog.value?.themes ?? []).map(theme => ({
      ...theme,
      unlocked: themes.value.includes(theme.id)
    }))
  )

  /** Packs du catalogue, marqués comme déjà rattachés au dossier. */
  const packCards = computed(() =>
    (catalog.value?.packs ?? []).map(pack => ({
      ...pack,
      owned: packs.value.includes(pack.id)
    }))
  )

  function apply(data: EntitlementsResponse) {
    account.value = data.account
    packs.value = data.packs
    modes.value = data.modes
    themes.value = data.themes
    credits.value = data.credits
  }

  /**
   * Recale le solde après une partie, sans rappeler l'API : le tirage renvoie
   * déjà les crédits à jour.
   */
  function applyCredits(next: Credits) {
    credits.value = next
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
   * Charge droits et catalogue. Le catalogue n'est lu qu'une fois : c'est une
   * vitrine identique pour tout le monde, seuls les droits changent.
   */
  async function refresh(): Promise<void> {
    if (status.value === 'idle') status.value = 'loading'
    try {
      const [rights, shop] = await Promise.all([
        options.request('/entitlements'),
        catalog.value ? null : options.request('/packs')
      ])

      if (!rights.ok) {
        status.value = 'error'
        return
      }
      apply((await rights.json()) as EntitlementsResponse)
      if (shop?.ok) catalog.value = (await shop.json()) as Catalog
      status.value = 'ready'
    }
    catch {
      status.value = 'error'
    }
  }

  /**
   * Rattache un pack au dossier. Gratuit aujourd'hui ; le jour où un paiement
   * s'intercale, c'est la réponse de cette route qui changera, pas l'appelant.
   */
  async function unlock(pack: PackId): Promise<boolean> {
    pending.value = true
    error.value = null
    try {
      const response = await options.request(`/packs/${pack}/unlock`, { method: 'POST' })
      if (!response.ok) {
        error.value = await messageOf(response)
        return false
      }
      apply((await response.json()) as EntitlementsResponse)
      return true
    }
    catch {
      error.value = GENERIC_ERROR
      return false
    }
    finally {
      pending.value = false
    }
  }

  function clearError(): void {
    error.value = null
  }

  return {
    status,
    account,
    packs,
    modes,
    themes,
    credits,
    catalog,
    pending,
    error,
    ready,
    canPlay,
    modeCards,
    themeCards,
    packCards,
    applyCredits,
    refresh,
    unlock,
    clearError
  }
}

export type Entitlements = ReturnType<typeof createEntitlements>
