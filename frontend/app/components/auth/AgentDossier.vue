<script setup lang="ts">
import { Camera, Trash2 } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

/**
 * Le dossier d'un agent identifié : sa photo, son nom de code, et les deux
 * sorties (déconnexion, suppression).
 *
 * Présentationnel comme les écrans de partie : props en entrée, emits en
 * sortie. Le fichier choisi remonte tel quel — sa réduction en vignette
 * (`~/utils/avatarImage`) a besoin d'un canvas, que la page fournit ; le garder
 * ici rendrait ce composant intestable.
 */
const props = withDefaults(defineProps<{
  /** Nom affiché, déjà résolu (nom de code ou partie locale de l'email). */
  label: string
  email: string
  displayName?: string | null
  initial?: string | null
  avatarUrl?: string | null
  /** Un compte né d'un OAuth n'a pas de mot de passe à redemander. */
  hasPassword?: boolean
  pending?: boolean
  error?: string | null
  /** Passe à vrai le temps d'un aller-retour réussi, pour l'accusé de réception. */
  saved?: boolean
}>(), {
  displayName: null,
  initial: null,
  avatarUrl: null,
  hasPassword: true,
  pending: false,
  error: null,
  saved: false
})

const emit = defineEmits<{
  rename: [string]
  photo: [File]
  'remove-photo': []
  logout: []
  'delete-account': [password?: string]
}>()

const name = ref(props.displayName ?? '')
const fileInput = ref<HTMLInputElement | null>(null)
const confirmingLogout = ref(false)
const confirmingDelete = ref(false)

// Le nom peut changer sans passer par ce champ (déconnexion, rechargement de
// session) : on resuit la source plutôt que de figer la valeur au montage.
watch(() => props.displayName, (value) => {
  name.value = value ?? ''
})

const trimmed = computed(() => name.value.trim())
const nameChanged = computed(() => trimmed.value !== (props.displayName ?? ''))

function pickPhoto(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  // Le champ est remis à zéro : sans ça, rechoisir le même fichier après une
  // erreur ne déclencherait aucun `change`.
  input.value = ''
  if (file) emit('photo', file)
}

/**
 * La fenêtre reste ouverte : en cas de refus (mauvais mot de passe) l'agent y
 * lit l'erreur et corrige sans tout ressaisir. En cas de succès il n'y a plus
 * de dossier à afficher, ce composant disparaît et la fenêtre avec lui.
 */
function confirmDelete(password?: string) {
  emit('delete-account', password)
}

const inputClass
  = 'w-full rounded-sm border border-subtle bg-surface-inset px-3 py-2.5 text-body text-primary '
    + 'placeholder:text-tertiary focus:border-strong focus:outline-none focus:ring-1 focus:ring-focus-ring'

const labelClass = 'font-display text-body-s uppercase tracking-caps text-secondary'
</script>

<template>
  <div class="flex flex-col gap-5">
    <Card class="flex flex-col gap-6">
      <div class="flex items-center gap-4">
        <Avatar :size="72" :initial="initial ?? '?'" :src="avatarUrl" />
        <div class="min-w-0">
          <div class="font-display text-body-s uppercase tracking-caps text-secondary">
            Agent identifié
          </div>
          <div class="mt-1 truncate font-mono text-body text-primary">{{ label }}</div>
          <div class="truncate font-mono text-caption text-tertiary">{{ email }}</div>
        </div>
      </div>

      <div class="flex flex-col gap-2.5">
        <span :class="labelClass">Photo d'identification</span>
        <div class="flex flex-wrap gap-2.5">
          <!-- Le bouton pilote un input caché : un input[type=file] nu ne peut
               pas être stylé, et son libellé natif n'est pas traduisible. -->
          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            class="hidden"
            aria-label="Choisir une photo"
            @change="pickPhoto"
          >
          <Button size="s" variant="ghost" :disabled="pending" @click="fileInput?.click()">
            <Camera :size="14" />
            {{ avatarUrl ? 'Changer la photo' : 'Ajouter une photo' }}
          </Button>
          <Button
            v-if="avatarUrl"
            size="s"
            variant="ghost"
            :disabled="pending"
            @click="emit('remove-photo')"
          >
            <Trash2 :size="14" />
            Retirer
          </Button>
        </div>
        <p class="font-mono text-caption text-tertiary">
          Recadrée en carré et réduite avant l'envoi. Elle ne quitte pas ton dossier.
        </p>
      </div>

      <form class="flex flex-col gap-2.5" @submit.prevent="emit('rename', trimmed)">
        <label class="flex flex-col gap-1.5">
          <span :class="labelClass">Nom de code</span>
          <input
            v-model="name"
            :class="inputClass"
            type="text"
            maxlength="60"
            placeholder="Laisse vide pour utiliser ton email"
            autocomplete="nickname"
          >
        </label>
        <div class="flex items-center gap-3">
          <Button size="s" type="submit" :disabled="pending || !nameChanged">
            Enregistrer
          </Button>
          <span v-if="saved && !nameChanged" class="font-mono text-caption text-tertiary">
            Dossier mis à jour.
          </span>
        </div>
      </form>

      <Toast v-if="error" tone="danger">{{ error }}</Toast>
    </Card>

    <Card class="flex flex-col gap-4">
      <div>
        <div class="font-display text-body-s uppercase tracking-caps text-secondary">
          Fin de service
        </div>
        <p class="mt-1.5 text-body-s text-tertiary">
          Se déconnecter garde ton dossier au chaud. Le détruire l'efface définitivement
          du QG, avec tes packs et tes crédits.
        </p>
      </div>
      <div class="flex flex-wrap gap-2.5">
        <Button size="s" variant="ghost" :disabled="pending" @click="confirmingLogout = true">
          Se déconnecter
        </Button>
        <Button size="s" variant="danger" :disabled="pending" @click="confirmingDelete = true">
          Supprimer mon compte
        </Button>
      </div>
    </Card>

    <LogoutConfirm
      :open="confirmingLogout"
      :pending="pending"
      @cancel="confirmingLogout = false"
      @confirm="confirmingLogout = false; emit('logout')"
    />

    <DeleteAccountDialog
      :open="confirmingDelete"
      :has-password="hasPassword"
      :pending="pending"
      :error="error"
      @cancel="confirmingDelete = false"
      @confirm="confirmDelete"
    />
  </div>
</template>
