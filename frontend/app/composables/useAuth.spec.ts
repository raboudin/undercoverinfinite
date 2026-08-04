import { describe, expect, it, vi } from 'vitest'
import { createAuth } from './useAuth'

const USER = {
  id: 'user-1',
  email: 'agent@undercover.test',
  displayName: 'Agent 42',
  avatarUpdatedAt: null,
  hasPassword: true
}

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body)
  } as Response
}

function makeAuth(fetchFn: typeof fetch) {
  return createAuth({ apiBase: 'http://api.test', fetchFn })
}

/** Options du n-ième appel à fetch. */
function initOf(fetchFn: ReturnType<typeof vi.fn>, call = 0): RequestInit {
  return fetchFn.mock.calls[call]?.[1] as RequestInit
}

describe('createAuth', () => {
  it('joint les cookies à chaque requête', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ user: USER }))
    const auth = makeAuth(fetchFn as unknown as typeof fetch)

    await auth.fetchSession()

    expect(fetchFn).toHaveBeenCalledWith('http://api.test/auth/me', expect.anything())
    // Sans `include`, aucun cookie n'est envoyé et tout répond 401.
    expect(initOf(fetchFn).credentials).toBe('include')
  })

  it('expose l’agent connecté après lecture de la session', async () => {
    const auth = makeAuth(vi.fn().mockResolvedValue(jsonResponse({ user: USER })) as unknown as typeof fetch)

    expect(auth.status.value).toBe('idle')
    expect(auth.resolved.value).toBe(false)

    await auth.fetchSession()

    expect(auth.status.value).toBe('authenticated')
    expect(auth.isAuthenticated.value).toBe(true)
    expect(auth.user.value).toEqual(USER)
    expect(auth.label.value).toBe('Agent 42')
  })

  it('retombe sur « anonyme » quand la session est absente', async () => {
    const auth = makeAuth(vi.fn().mockResolvedValue(jsonResponse({}, 401)) as unknown as typeof fetch)

    await auth.fetchSession()

    expect(auth.status.value).toBe('anonymous')
    expect(auth.user.value).toBeNull()
    expect(auth.resolved.value).toBe(true)
  })

  it('reste jouable si l’API est injoignable', async () => {
    const auth = makeAuth(vi.fn().mockRejectedValue(new Error('réseau HS')) as unknown as typeof fetch)

    await auth.fetchSession()

    expect(auth.status.value).toBe('anonymous')
  })

  it('rejoue la requête après rotation quand l’access token a expiré', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(jsonResponse({}, 401)) // access token périmé
      .mockResolvedValueOnce(jsonResponse({ user: USER })) // /auth/refresh
      .mockResolvedValueOnce(jsonResponse({ user: USER })) // /auth/me rejoué
    const auth = makeAuth(fetchFn as unknown as typeof fetch)

    await auth.fetchSession()

    expect(fetchFn.mock.calls.map(call => call[0])).toEqual([
      'http://api.test/auth/me',
      'http://api.test/auth/refresh',
      'http://api.test/auth/me'
    ])
    expect(auth.status.value).toBe('authenticated')
  })

  it('n’insiste pas quand la rotation échoue aussi', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(jsonResponse({}, 401))
      .mockResolvedValueOnce(jsonResponse({}, 401)) // refresh refusé
    const auth = makeAuth(fetchFn as unknown as typeof fetch)

    await auth.fetchSession()

    expect(fetchFn).toHaveBeenCalledTimes(2)
    expect(auth.status.value).toBe('anonymous')
  })

  it('connecte et remonte l’agent', async () => {
    const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ user: USER }))
    const auth = makeAuth(fetchFn as unknown as typeof fetch)

    await expect(auth.login({ email: 'agent@undercover.test', password: 'motdepasse-1' })).resolves.toBe(true)

    expect(initOf(fetchFn).method).toBe('POST')
    expect(JSON.parse(initOf(fetchFn).body as string)).toEqual({
      email: 'agent@undercover.test',
      password: 'motdepasse-1'
    })
    expect(auth.isAuthenticated.value).toBe(true)
    expect(auth.pending.value).toBe(false)
  })

  it('affiche le message d’erreur de l’API', async () => {
    const auth = makeAuth(
      vi.fn().mockResolvedValue(
        jsonResponse({ message: 'Email ou mot de passe incorrect.' }, 401)
      ) as unknown as typeof fetch
    )

    await expect(auth.login({ email: 'agent@undercover.test', password: 'faux' })).resolves.toBe(false)

    expect(auth.error.value).toBe('Email ou mot de passe incorrect.')
    expect(auth.isAuthenticated.value).toBe(false)
  })

  it('prend la première ligne d’une erreur de validation', async () => {
    const auth = makeAuth(
      vi.fn().mockResolvedValue(
        jsonResponse({ message: ['Adresse email invalide.', 'autre détail'] }, 400)
      ) as unknown as typeof fetch
    )

    await auth.register({ email: 'pas-un-email', password: 'motdepasse-1' })

    expect(auth.error.value).toBe('Adresse email invalide.')
  })

  it('déconnecte localement même si l’API échoue', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ user: USER }))
      .mockRejectedValueOnce(new Error('réseau HS'))
    const auth = makeAuth(fetchFn as unknown as typeof fetch)
    await auth.login({ email: 'agent@undercover.test', password: 'motdepasse-1' })

    await auth.logout()

    expect(auth.user.value).toBeNull()
    expect(auth.status.value).toBe('anonymous')
  })

  it('n’annonce un fournisseur social qu’après confirmation de l’API', async () => {
    const auth = makeAuth(
      vi.fn().mockResolvedValue(jsonResponse({ google: true, facebook: false })) as unknown as typeof fetch
    )

    expect(auth.providers.value.google).toBe(false)
    await auth.fetchProviders()

    expect(auth.providers.value).toEqual({ google: true, facebook: false })
    expect(auth.googleUrl).toBe('http://api.test/auth/google')
  })

  it('retombe sur la partie locale de l’email sans nom de code', async () => {
    const auth = makeAuth(
      vi.fn().mockResolvedValue(
        jsonResponse({ user: { ...USER, displayName: null } })
      ) as unknown as typeof fetch
    )

    await auth.fetchSession()

    expect(auth.label.value).toBe('agent')
    expect(auth.initial.value).toBe('A')
  })

  describe('dossier d’agent', () => {
    /** Session ouverte, puis une réponse par appel suivant. */
    async function loggedIn(...responses: Response[]) {
      const fetchFn = vi.fn().mockResolvedValueOnce(jsonResponse({ user: USER }))
      for (const response of responses) fetchFn.mockResolvedValueOnce(response)
      const auth = makeAuth(fetchFn as unknown as typeof fetch)
      await auth.fetchSession()
      fetchFn.mockClear()
      return { auth, fetchFn }
    }

    it('n’expose une URL de photo qu’une fois la photo déposée', async () => {
      const { auth } = await loggedIn()
      expect(auth.avatarUrl.value).toBeNull()

      const withPhoto = { ...USER, avatarUpdatedAt: '2026-08-04T10:00:00.000Z' }
      const { auth: auth2 } = await loggedIn(jsonResponse({ user: withPhoto }))
      await auth2.setAvatar('data:image/webp;base64,AAAA')

      // Le `?v=` est ce qui rend le cache de l'API sans danger : sans lui, la
      // photo précédente resterait affichée jusqu'à son expiration.
      expect(auth2.avatarUrl.value).toBe(
        'http://api.test/auth/avatar/user-1?v=2026-08-04T10%3A00%3A00.000Z'
      )
    })

    it('renomme l’agent et remplace la session', async () => {
      const renamed = { ...USER, displayName: 'Corbeau' }
      const { auth, fetchFn } = await loggedIn(jsonResponse({ user: renamed }))

      await expect(auth.updateProfile({ displayName: 'Corbeau' })).resolves.toBe(true)

      expect(fetchFn).toHaveBeenCalledWith('http://api.test/auth/me', expect.anything())
      expect(initOf(fetchFn).method).toBe('PATCH')
      expect(auth.label.value).toBe('Corbeau')
    })

    it('dépose puis retire la photo', async () => {
      const { auth, fetchFn } = await loggedIn(
        jsonResponse({ user: { ...USER, avatarUpdatedAt: '2026-08-04T10:00:00.000Z' } }),
        jsonResponse({ user: USER })
      )

      await auth.setAvatar('data:image/webp;base64,AAAA')
      expect(fetchFn.mock.calls[0]?.[0]).toBe('http://api.test/auth/me/avatar')
      expect(initOf(fetchFn).method).toBe('PUT')
      expect(JSON.parse(initOf(fetchFn).body as string)).toEqual({
        data: 'data:image/webp;base64,AAAA'
      })

      await auth.removeAvatar()
      expect(initOf(fetchFn, 1).method).toBe('DELETE')
      expect(auth.avatarUrl.value).toBeNull()
    })

    it('supprime le compte et retombe sur anonyme', async () => {
      // 204 sans corps : il n'y a plus de session à lire.
      const { auth, fetchFn } = await loggedIn(
        { ok: true, status: 204, json: () => Promise.reject(new Error('sans corps')) } as unknown as Response
      )

      await expect(auth.deleteAccount('motdepasse-1')).resolves.toBe(true)

      expect(fetchFn).toHaveBeenCalledWith('http://api.test/auth/me', expect.anything())
      expect(initOf(fetchFn).method).toBe('DELETE')
      expect(JSON.parse(initOf(fetchFn).body as string)).toEqual({ password: 'motdepasse-1' })
      expect(auth.user.value).toBeNull()
      expect(auth.status.value).toBe('anonymous')
    })

    it('garde la session quand la suppression est refusée', async () => {
      // 403 et non 401 côté API : la session est valable, c'est le mot de
      // passe qui ne l'est pas — donc aucune rotation, aucun rejeu.
      const { auth, fetchFn } = await loggedIn(
        jsonResponse({ message: 'Mot de passe incorrect.' }, 403)
      )

      await expect(auth.deleteAccount('à côté')).resolves.toBe(false)

      expect(fetchFn).toHaveBeenCalledTimes(1)
      expect(auth.error.value).toBe('Mot de passe incorrect.')
      expect(auth.isAuthenticated.value).toBe(true)
    })

    it('supprime un compte OAuth sans mot de passe', async () => {
      const { auth, fetchFn } = await loggedIn(
        { ok: true, status: 204, json: () => Promise.reject(new Error('sans corps')) } as unknown as Response
      )

      await auth.deleteAccount()

      expect(JSON.parse(initOf(fetchFn).body as string)).toEqual({})
    })
  })
})
