import { watch } from 'vue'
import { createEntitlements } from '~/composables/useEntitlements'
import { createWords } from '~/composables/useWords'

/**
 * Droits et tirage de mots, exposés en `$entitlements` et `$words`.
 *
 * Même raison qu'`~/plugins/auth.ts` de ne pas être un état de module : ces
 * deux objets décrivent **un** joueur (ses packs, ses crédits), et un `ref` de
 * module serait partagé par tous les visiteurs d'un même serveur SSR.
 *
 * `dependsOn: ['auth']` parce que les deux passent par `$auth.authFetch` : les
 * routes lisent les cookies httpOnly et doivent pouvoir rejouer une requête
 * après rotation du token.
 */
export default defineNuxtPlugin({
  name: 'entitlements',
  dependsOn: ['auth'],
  setup(nuxtApp) {
    const auth = nuxtApp.$auth as ReturnType<
      typeof import('~/composables/useAuth').createAuth
    >

    const entitlements = createEntitlements({ request: auth.authFetch })
    const words = createWords({ request: auth.authFetch })

    if (import.meta.client) {
      void entitlements.refresh()

      // Se connecter ou se déconnecter change les packs et le quota : sans ce
      // rappel, l'écran garderait les droits de l'ancienne session jusqu'au
      // prochain rechargement complet.
      watch(
        () => auth.user.value?.id ?? null,
        (next, previous) => {
          if (next !== previous) void entitlements.refresh()
        }
      )
    }

    return { provide: { entitlements, words } }
  }
})
