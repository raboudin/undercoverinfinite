<script setup lang="ts">
import { computed, ref, watch } from 'vue'

export type AuthMode = 'login' | 'register'

/** Aligné sur `MIN_PASSWORD_LENGTH` côté API : inutile d'envoyer un 400 certain. */
const MIN_PASSWORD_LENGTH = 10

const props = withDefaults(defineProps<{
  mode?: AuthMode
  pending?: boolean
  /** Erreur renvoyée par l'API (identifiants, email pris, réseau…). */
  error?: string | null
  /** Absent = la connexion Google n'est pas configurée sur ce serveur. */
  googleUrl?: string | null
}>(), {
  mode: 'login',
  pending: false,
  error: null,
  googleUrl: null
})

const emit = defineEmits<{
  submit: [{ email: string, password: string, displayName?: string }]
  'update:mode': [AuthMode]
}>()

const email = ref('')
const password = ref('')
const displayName = ref('')

const isRegister = computed(() => props.mode === 'register')

const passwordTooShort = computed(
  () => isRegister.value && password.value.length > 0 && password.value.length < MIN_PASSWORD_LENGTH
)
const canSubmit = computed(
  () => !props.pending
    && email.value.trim().length > 0
    && password.value.length > 0
    && !passwordTooShort.value
)

// Changer de mode ne doit pas garder l'erreur du mode précédent sous les yeux.
watch(() => props.mode, () => {
  password.value = ''
})

function submit() {
  if (!canSubmit.value) return
  emit('submit', {
    email: email.value.trim(),
    password: password.value,
    ...(isRegister.value && displayName.value.trim() ? { displayName: displayName.value.trim() } : {})
  })
}

const inputClass
  = 'w-full rounded-sm border border-subtle bg-surface-inset px-3 py-2.5 text-body text-primary '
    + 'placeholder:text-tertiary focus:border-strong focus:outline-none focus:ring-1 focus:ring-focus-ring'

const labelClass = 'font-display text-body-s uppercase tracking-caps text-secondary'
</script>

<template>
  <div class="flex flex-col gap-5">
    <a
      v-if="googleUrl"
      :href="googleUrl"
      class="inline-flex w-full items-center justify-center gap-2.5 rounded-sm border border-default bg-transparent px-5 py-3 font-display text-sm font-semibold uppercase tracking-caps text-primary transition duration-150 ease-out hover:border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
    >
      <svg class="h-4 w-4 shrink-0" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.3 6.6v5.500h7c4.1-3.8 6.6-9.4 6.6-16.1z" />
        <path fill="#34A853" d="M24 46c5.8 0 10.7-1.9 14.3-5.2l-7-5.4c-1.9 1.3-4.4 2.1-7.3 2.1-5.6 0-10.4-3.8-12.1-8.9H4.7v5.6C8.3 41.4 15.6 46 24 46z" />
        <path fill="#FBBC05" d="M11.9 28.6c-.4-1.3-.7-2.7-.7-4.1s.2-2.8.7-4.1v-5.6H4.7C3.2 17.7 2.4 20.8 2.4 24s.8 6.3 2.3 9.2l7.2-4.6z" />
        <path fill="#EA4335" d="M24 9.9c3.2 0 6 1.1 8.2 3.2l6.2-6.2C34.7 3.5 29.8 1.4 24 1.4 15.6 1.4 8.3 6 4.7 14.8l7.2 5.6C13.6 15.3 18.4 9.9 24 9.9z" />
      </svg>
      Continuer avec Google
    </a>

    <div v-if="googleUrl" class="flex items-center gap-3">
      <div class="h-px flex-1 bg-subtle" />
      <span class="font-mono text-caption uppercase tracking-caps text-tertiary">ou</span>
      <div class="h-px flex-1 bg-subtle" />
    </div>

    <form class="flex flex-col gap-4" @submit.prevent="submit">
      <label v-if="isRegister" class="flex flex-col gap-1.5">
        <span :class="labelClass">Nom de code</span>
        <input
          v-model="displayName"
          :class="inputClass"
          type="text"
          maxlength="60"
          placeholder="Facultatif"
          autocomplete="nickname"
        >
      </label>

      <label class="flex flex-col gap-1.5">
        <span :class="labelClass">Adresse de contact</span>
        <input
          v-model="email"
          :class="inputClass"
          type="email"
          required
          maxlength="254"
          placeholder="agent@exemple.com"
          autocomplete="email"
        >
      </label>

      <label class="flex flex-col gap-1.5">
        <span :class="labelClass">Code d'accès</span>
        <input
          v-model="password"
          :class="inputClass"
          type="password"
          required
          maxlength="72"
          :placeholder="isRegister ? `${MIN_PASSWORD_LENGTH} caractères minimum` : '••••••••••'"
          :autocomplete="isRegister ? 'new-password' : 'current-password'"
        >
        <span v-if="passwordTooShort" class="font-mono text-caption text-tertiary">
          Encore {{ MIN_PASSWORD_LENGTH - password.length }} caractère{{ MIN_PASSWORD_LENGTH - password.length > 1 ? 's' : '' }}.
        </span>
      </label>

      <Toast v-if="error" tone="danger">{{ error }}</Toast>

      <Button type="submit" size="l" class="w-full" :disabled="!canSubmit">
        {{ pending ? 'Transmission…' : isRegister ? 'Ouvrir un dossier' : 'Prendre son poste' }}
      </Button>
    </form>

    <button
      type="button"
      class="cursor-pointer text-center font-mono text-caption text-tertiary underline-offset-4 transition hover:text-secondary hover:underline"
      @click="emit('update:mode', isRegister ? 'login' : 'register')"
    >
      {{ isRegister ? 'Déjà un dossier au QG ? Se connecter' : 'Pas encore de dossier ? En ouvrir un' }}
    </button>
  </div>
</template>
