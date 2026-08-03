<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

type AuthMode = 'login' | 'register'

// Déstructuré pour que le template profite du déballage automatique des refs.
const {
  pending,
  error,
  resolved,
  label,
  googleUrl,
  providers,
  login,
  register,
  logout,
  fetchProviders,
  clearError
} = useNuxtApp().$auth

const route = useRoute()
const router = useRouter()

const mode = ref<AuthMode>('login')

/**
 * Codes posés par l'API sur l'URL de retour quand le parcours OAuth échoue
 * (voir `AuthController.failureUrl`).
 */
const OAUTH_ERRORS: Record<string, string> = {
  oauth_rejected: "Le QG a refusé cette identité Google. Si un dossier existe déjà à cette adresse, connecte-toi avec ton code d'accès.",
  oauth_failed: 'La connexion Google a été interrompue en route. Réessaie.'
}

const oauthError = computed(() => {
  const code = route.query.error
  if (typeof code !== 'string') return null
  return OAUTH_ERRORS[code] ?? OAUTH_ERRORS.oauth_failed
})

// L'erreur d'une tentative en cours prime sur celle rapportée par l'URL.
const displayedError = computed(() => error.value ?? oauthError.value)

useHead({ title: 'Accès au QG — Undercover Infinite' })

onMounted(() => {
  void fetchProviders()
})

async function submit(payload: { email: string, password: string, displayName?: string }) {
  const success = mode.value === 'login' ? await login(payload) : await register(payload)
  if (success) await router.push('/')
}

function changeMode(next: AuthMode) {
  clearError()
  mode.value = next
}
</script>

<template>
  <div class="flex flex-col gap-7">
    <div class="flex flex-col gap-2">
      <h1 class="font-display text-display-m uppercase tracking-caps text-primary">
        Accès au QG
      </h1>
      <p class="text-body-s text-tertiary">
        Un dossier d'agent n'est pas nécessaire pour jouer en pass-and-play. Il te servira
        à retrouver tes parties quand le réseau en ligne ouvrira.
      </p>
    </div>

    <!-- Session encore en cours de résolution : rien plutôt qu'un formulaire
         qui disparaîtrait sous les yeux d'un agent déjà identifié. -->
    <Card v-if="!resolved">
      <p class="font-mono text-caption text-tertiary">Vérification de tes accréditations…</p>
    </Card>

    <Card v-else-if="label" class="flex flex-col gap-4">
      <div>
        <div class="font-display text-body-s uppercase tracking-caps text-secondary">
          Agent identifié
        </div>
        <div class="mt-1 font-mono text-body text-primary">{{ label }}</div>
      </div>
      <div class="flex flex-wrap gap-2.5">
        <Button size="s" @click="router.push('/')">Retour au terrain</Button>
        <Button size="s" variant="ghost" :disabled="pending" @click="logout()">
          Se déconnecter
        </Button>
      </div>
    </Card>

    <Card v-else>
      <AuthForm
        :mode="mode"
        :pending="pending"
        :error="displayedError"
        :google-url="providers.google ? googleUrl : null"
        @submit="submit"
        @update:mode="changeMode"
      />
    </Card>

    <NuxtLink
      to="/"
      class="text-center font-mono text-caption text-tertiary underline-offset-4 transition hover:text-secondary hover:underline"
    >
      Reprendre la partie sans compte
    </NuxtLink>
  </div>
</template>
