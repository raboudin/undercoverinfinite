<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { AvatarImageError, toAvatarDataUrl } from '~/utils/avatarImage'

type AuthMode = 'login' | 'register'

// Déstructuré pour que le template profite du déballage automatique des refs.
const {
  user,
  pending,
  error,
  resolved,
  label,
  initial,
  avatarUrl,
  googleUrl,
  providers,
  login,
  register,
  logout,
  updateProfile,
  setAvatar,
  removeAvatar,
  deleteAccount,
  fetchProviders,
  clearError
} = useNuxtApp().$auth

const route = useRoute()
const router = useRouter()

const mode = ref<AuthMode>('login')

/**
 * Erreur née dans le navigateur (image illisible, trop lourde) : elle n'est
 * jamais passée par l'API, `error` ne la connaît donc pas.
 */
const localError = ref<string | null>(null)
const saved = ref(false)

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
const dossierError = computed(() => localError.value ?? error.value)

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

/** Réinitialise les deux canaux d'erreur avant chaque geste sur le dossier. */
function beginEdit() {
  localError.value = null
  saved.value = false
  clearError()
}

async function rename(displayName: string) {
  beginEdit()
  saved.value = await updateProfile({ displayName })
}

/**
 * La réduction en vignette se fait ici, et pas dans `AgentDossier` : elle a
 * besoin d'un canvas, ce qui rendrait ce composant impossible à monter en test.
 */
async function uploadPhoto(file: File) {
  beginEdit()
  try {
    saved.value = await setAvatar(await toAvatarDataUrl(file))
  }
  catch (cause) {
    localError.value = cause instanceof AvatarImageError
      ? cause.message
      : "Impossible de préparer cette image."
  }
}

async function dropPhoto() {
  beginEdit()
  saved.value = await removeAvatar()
}

async function destroyAccount(password?: string) {
  beginEdit()
  // Succès : plus de dossier, plus de raison de rester sur cet écran.
  if (await deleteAccount(password)) await router.push('/')
}
</script>

<template>
  <div class="flex flex-col gap-7">
    <div class="flex flex-col gap-2">
      <h1 class="font-display text-display-m uppercase tracking-caps text-primary">
        {{ label ? 'Dossier d’agent' : 'Accès au QG' }}
      </h1>
      <p class="text-body-s text-tertiary">
        <template v-if="label">
          Ton nom de code et ta photo t'identifieront auprès des autres agents quand le
          réseau en ligne ouvrira.
        </template>
        <template v-else>
          Un dossier d'agent n'est pas nécessaire pour jouer en pass-and-play. Il te servira
          à retrouver tes parties quand le réseau en ligne ouvrira.
        </template>
      </p>
    </div>

    <!-- Session encore en cours de résolution : rien plutôt qu'un formulaire
         qui disparaîtrait sous les yeux d'un agent déjà identifié. -->
    <Card v-if="!resolved">
      <p class="font-mono text-caption text-tertiary">Vérification de tes accréditations…</p>
    </Card>

    <AgentDossier
      v-else-if="label && user"
      :label="label"
      :email="user.email"
      :display-name="user.displayName"
      :initial="initial"
      :avatar-url="avatarUrl"
      :has-password="user.hasPassword"
      :pending="pending"
      :error="dossierError"
      :saved="saved"
      @rename="rename"
      @photo="uploadPhoto"
      @remove-photo="dropPhoto"
      @logout="logout()"
      @delete-account="destroyAccount"
    />

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
      {{ label ? 'Retour au terrain' : 'Reprendre la partie sans compte' }}
    </NuxtLink>
  </div>
</template>
