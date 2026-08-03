import { createAuth } from '~/composables/useAuth'

/**
 * Instance unique de session, exposée en `$auth` (`useNuxtApp().$auth`).
 *
 * Un plugin plutôt qu'un état de module : Nuxt en crée une par requête SSR,
 * là où un `ref` de module serait partagé par tous les visiteurs du serveur.
 *
 * Nommé parce que `~/plugins/entitlements.ts` déclare en dépendre : il lui
 * emprunte `authFetch` et doit donc s'exécuter après.
 */
export default defineNuxtPlugin({
  name: 'auth',
  setup() {
    const config = useRuntimeConfig()
    const auth = createAuth({ apiBase: config.public.apiBase })

    // Côté client seulement : les tokens sont dans des cookies httpOnly que le
    // rendu serveur ne relaie pas (il faudrait forwarder l'en-tête Cookie). Le
    // bandeau de compte s'affiche donc juste après l'hydratation.
    if (import.meta.client) void auth.fetchSession()

    return { provide: { auth } }
  }
})
