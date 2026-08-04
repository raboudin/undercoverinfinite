<script setup lang="ts">
import { LogIn, LogOut } from '@lucide/vue'
import { ref } from 'vue'

withDefaults(defineProps<{
  /** Nom affiché de l'agent connecté ; `null` = personne. */
  label?: string | null
  /** Initiale de repli, quand il n'y a pas de photo. */
  initial?: string | null
  avatarUrl?: string | null
  /** Tant que la session n'est pas résolue, on n'affiche rien : pas de clignotement. */
  resolved?: boolean
  pending?: boolean
}>(), {
  label: null,
  initial: null,
  avatarUrl: null,
  resolved: false,
  pending: false
})

const emit = defineEmits<{ logout: [] }>()

// La déconnexion passe par une confirmation : le bouton est dans l'en-tête,
// donc à portée de pouce en pleine partie.
const confirming = ref(false)

function confirm() {
  confirming.value = false
  emit('logout')
}
</script>

<template>
  <div v-if="resolved" class="flex items-center gap-2">
    <template v-if="label">
      <!-- Seul chemin vers le dossier une fois connecté : sans ce lien, il n'y
           aurait plus aucun moyen d'atteindre /connexion pour s'y modifier. -->
      <NuxtLink
        to="/connexion"
        aria-label="Dossier d'agent"
        class="flex items-center gap-2 rounded-sm transition-opacity hover:opacity-80"
      >
        <Avatar :size="26" :initial="initial ?? '?'" :src="avatarUrl" />
        <span class="max-w-24 truncate font-mono text-caption text-tertiary">{{ label }}</span>
      </NuxtLink>
      <IconButton
        :size="34"
        :disabled="pending"
        aria-label="Se déconnecter"
        @click="confirming = true"
      >
        <LogOut :size="15" />
      </IconButton>
      <LogoutConfirm
        :open="confirming"
        :pending="pending"
        @cancel="confirming = false"
        @confirm="confirm"
      />
    </template>

    <!-- Un lien, pas un IconButton : un <button> dans un <a> est du HTML invalide. -->
    <NuxtLink
      v-else
      to="/connexion"
      aria-label="Se connecter"
      class="flex h-[34px] w-[34px] items-center justify-center rounded-sm border border-subtle bg-transparent text-secondary transition-colors duration-150 ease-out hover:border-strong"
    >
      <LogIn :size="15" />
    </NuxtLink>
  </div>
</template>
