<script lang="ts">
/**
 * Mot à recopier pour confirmer. Exporté depuis un `<script>` classique — un
 * `<script setup>` n'admet pas d'export — pour que la spec teste la vraie
 * valeur plutôt qu'une copie.
 */
export const CONFIRMATION_PHRASE = 'SUPPRIMER'
</script>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'

/**
 * Suppression définitive du dossier (droit à l'effacement, RGPD).
 *
 * Deux barrières plutôt qu'une : la phrase à recopier — qui vaut pour tout le
 * monde, y compris les comptes ouverts via Google qui n'ont pas de mot de
 * passe — et le mot de passe courant quand le compte en a un. L'API réexige de
 * toute façon ce dernier ; le champ n'est ici que pour le lui fournir.
 */
const props = withDefaults(defineProps<{
  open: boolean
  /** Un compte né d'un OAuth n'a pas de mot de passe à redemander. */
  hasPassword?: boolean
  pending?: boolean
  error?: string | null
}>(), {
  hasPassword: true,
  pending: false,
  error: null
})

const emit = defineEmits<{
  /** Mot de passe courant, absent pour un compte sans mot de passe. */
  confirm: [password?: string]
  cancel: []
}>()

const phrase = ref('')
const password = ref('')

// Rouvrir la fenêtre après une erreur ne doit pas laisser la saisie
// précédente en place : la confirmation se refait entièrement.
watch(() => props.open, (open) => {
  if (!open) return
  phrase.value = ''
  password.value = ''
})

const phraseTyped = computed(() => phrase.value.trim().toUpperCase() === CONFIRMATION_PHRASE)
const canConfirm = computed(
  () => !props.pending && phraseTyped.value && (!props.hasPassword || password.value.length > 0)
)

function confirm() {
  if (!canConfirm.value) return
  emit('confirm', props.hasPassword ? password.value : undefined)
}

const inputClass
  = 'w-full rounded-sm border border-subtle bg-surface-inset px-3 py-2.5 text-body text-primary '
    + 'placeholder:text-tertiary focus:border-strong focus:outline-none focus:ring-1 focus:ring-focus-ring'

const labelClass = 'font-display text-body-s uppercase tracking-caps text-secondary'
</script>

<template>
  <Modal :open="open" title="Détruire le dossier ?" @close="emit('cancel')">
    <form class="flex max-w-xs flex-col gap-5" @submit.prevent="confirm">
      <p class="text-body-s text-secondary">
        Cette opération est <strong class="text-primary">définitive</strong>. Ton compte,
        tes packs, tes crédits, ta photo et tout l'historique de tes tirages seront
        effacés du QG. Rien ne sera récupérable.
      </p>

      <label class="flex flex-col gap-1.5">
        <span :class="labelClass">Écris « {{ CONFIRMATION_PHRASE }} »</span>
        <input
          v-model="phrase"
          :class="inputClass"
          type="text"
          autocomplete="off"
          :placeholder="CONFIRMATION_PHRASE"
          aria-label="Phrase de confirmation"
        >
      </label>

      <label v-if="hasPassword" class="flex flex-col gap-1.5">
        <span :class="labelClass">Code d'accès</span>
        <input
          v-model="password"
          :class="inputClass"
          type="password"
          maxlength="72"
          placeholder="••••••••••"
          autocomplete="current-password"
          aria-label="Code d'accès"
        >
      </label>

      <Toast v-if="error" tone="danger">{{ error }}</Toast>

      <div class="flex flex-wrap justify-end gap-2.5">
        <Button size="s" variant="ghost" type="button" @click="emit('cancel')">
          Annuler
        </Button>
        <Button size="s" variant="danger" type="submit" :disabled="!canConfirm">
          {{ pending ? 'Destruction…' : 'Détruire le dossier' }}
        </Button>
      </div>
    </form>
  </Modal>
</template>
