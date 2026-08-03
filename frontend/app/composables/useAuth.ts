import { computed, ref } from 'vue'

export interface AuthUser {
  id: string
  email: string
  displayName: string | null
}

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'anonymous'

export interface Credentials {
  email: string
  password: string
}

export interface Registration extends Credentials {
  displayName?: string
}

interface SessionResponse {
  user: AuthUser
}

/** Fournisseurs OAuth réellement configurés côté API (`GET /auth/providers`). */
export interface AuthProviders {
  google: boolean
  facebook: boolean
}

/** Message de repli quand l'API est injoignable ou répond n'importe quoi. */
const GENERIC_ERROR = 'Le QG ne répond pas. Réessaie dans un instant.'

/**
 * Session utilisateur, servie par l'API (`/auth/*`).
 *
 * Factory comme `createGame`/`createDailyWords` : les tests injectent `fetchFn`,
 * l'app en instancie **une seule** via le plugin `~/plugins/auth.ts` (et non un
 * état de module comme `useBackgroundMusic` — une session appartient à un
 * utilisateur, la partager entre les requêtes SSR la ferait fuir d'un visiteur
 * à l'autre).
 *
 * Aucun token n'est manipulé ici : ils vivent uniquement dans des cookies
 * httpOnly que le navigateur joint tout seul grâce à `credentials: 'include'`.
 */
export function createAuth(options: { apiBase: string, fetchFn?: typeof fetch }) {
  const fetchFn = options.fetchFn ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init))

  const user = ref<AuthUser | null>(null)
  const status = ref<AuthStatus>('idle')
  const pending = ref(false)
  const error = ref<string | null>(null)
  // Faux par défaut : on n'affiche un bouton social qu'une fois l'API
  // confirmée, plutôt que de proposer un chemin qui répondrait 503.
  const providers = ref<AuthProviders>({ google: false, facebook: false })

  const isAuthenticated = computed(() => status.value === 'authenticated')
  const resolved = computed(() => status.value === 'authenticated' || status.value === 'anonymous')

  /** Nom affiché : le nom de code, sinon la partie locale de l'email. */
  const label = computed(() => {
    if (!user.value) return null
    return user.value.displayName || user.value.email.split('@')[0]
  })

  /**
   * Entrée du parcours Google. C'est une **vraie navigation** (`window.location`
   * ou un `<a href>`), jamais un `fetch` : le navigateur doit suivre les
   * redirections vers Google puis revenir sur l'API pour recevoir les cookies.
   */
  const googleUrl = `${options.apiBase}/auth/google`

  function request(path: string, init?: RequestInit): Promise<Response> {
    return fetchFn(`${options.apiBase}${path}`, {
      ...init,
      // Sans ça le navigateur n'envoie aucun cookie et toute route protégée
      // répond 401 — c'est la ligne qui fait tenir toute l'authentification.
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...init?.headers }
    })
  }

  /** Extrait le message d'erreur de Nest (`message` peut être un tableau). */
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
   * Rejoue une requête une fois après rotation du refresh token. L'access token
   * ne vit que 5 h, le refresh 30 j : sans ce rattrapage, l'utilisateur serait
   * déconnecté chaque après-midi alors que sa session est encore valable.
   */
  async function withRefresh(run: () => Promise<Response>): Promise<Response> {
    const first = await run()
    if (first.status !== 401) return first

    const refreshed = await request('/auth/refresh', { method: 'POST' })
    if (!refreshed.ok) return first
    return run()
  }

  /**
   * Requête authentifiée à l'API, cookies et rotation compris. Prévu pour les
   * écrans à venir (lobby en ligne), au-delà des routes `/auth/*`.
   */
  function authFetch(path: string, init?: RequestInit): Promise<Response> {
    return withRefresh(() => request(path, init))
  }

  /** Relit la session depuis le cookie. Silencieux : pas d'erreur affichée. */
  async function fetchSession(): Promise<void> {
    if (status.value === 'idle') status.value = 'loading'
    try {
      const response = await authFetch('/auth/me')
      if (response.ok) {
        user.value = ((await response.json()) as SessionResponse).user
        status.value = 'authenticated'
        return
      }
    }
    catch {
      // Réseau coupé : on retombe sur « anonyme », l'app reste jouable.
    }
    user.value = null
    status.value = 'anonymous'
  }

  /** Quels boutons sociaux ce serveur peut réellement honorer. */
  async function fetchProviders(): Promise<void> {
    try {
      const response = await request('/auth/providers')
      if (response.ok) providers.value = (await response.json()) as AuthProviders
    }
    catch {
      // API injoignable : on reste sur « aucun fournisseur », le formulaire
      // email/mot de passe suffit à ne pas bloquer l'écran.
    }
  }

  async function submit(path: string, body: Credentials | Registration): Promise<boolean> {
    pending.value = true
    error.value = null
    try {
      const response = await request(path, { method: 'POST', body: JSON.stringify(body) })
      if (!response.ok) {
        error.value = await messageOf(response)
        return false
      }
      user.value = ((await response.json()) as SessionResponse).user
      status.value = 'authenticated'
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

  function login(credentials: Credentials): Promise<boolean> {
    return submit('/auth/login', credentials)
  }

  function register(registration: Registration): Promise<boolean> {
    return submit('/auth/register', registration)
  }

  /**
   * Déconnexion : l'API révoque le refresh token et vide les cookies. L'état
   * local retombe à « anonyme » même si l'appel échoue — l'utilisateur a
   * demandé à sortir, l'interface doit le refléter.
   */
  async function logout(): Promise<void> {
    pending.value = true
    try {
      await request('/auth/logout', { method: 'POST' })
    }
    catch {
      // Rien à rattraper : les cookies expireront d'eux-mêmes.
    }
    finally {
      user.value = null
      status.value = 'anonymous'
      error.value = null
      pending.value = false
    }
  }

  function clearError(): void {
    error.value = null
  }

  return {
    user,
    status,
    pending,
    error,
    providers,
    isAuthenticated,
    resolved,
    label,
    googleUrl,
    authFetch,
    fetchSession,
    fetchProviders,
    login,
    register,
    logout,
    clearError
  }
}

export type Auth = ReturnType<typeof createAuth>
