import { describe, expect, it, vi } from 'vitest'
import { createAuth } from './useAuth'

const USER = { id: 'user-1', email: 'agent@undercover.test', displayName: 'Agent 42' }

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
  })
})
