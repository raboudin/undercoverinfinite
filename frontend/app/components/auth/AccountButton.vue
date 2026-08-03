<script setup lang="ts">
import { LogIn, LogOut } from '@lucide/vue'

withDefaults(defineProps<{
  /** Nom affiché de l'agent connecté ; `null` = personne. */
  label?: string | null
  /** Tant que la session n'est pas résolue, on n'affiche rien : pas de clignotement. */
  resolved?: boolean
  pending?: boolean
}>(), {
  label: null,
  resolved: false,
  pending: false
})

const emit = defineEmits<{ logout: [] }>()
</script>

<template>
  <div v-if="resolved" class="flex items-center gap-2">
    <template v-if="label">
      <span class="max-w-24 truncate font-mono text-caption text-tertiary">{{ label }}</span>
      <IconButton
        :size="34"
        :disabled="pending"
        aria-label="Se déconnecter"
        @click="emit('logout')"
      >
        <LogOut :size="15" />
      </IconButton>
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
