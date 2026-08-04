<script setup lang="ts">
import { ChevronRight, Lock } from '@lucide/vue'
import type { ThemeCard } from '../../composables/useEntitlements'
import { themeThumb } from '../../utils/gameArt'

/**
 * Entrée du menu vers la vitrine des thèmes. Une fois le dossier choisi, le
 * bouton devient sa fiche : vignette, nom, accroche — de quoi savoir avec quoi
 * on part sans rouvrir la vitrine.
 */
withDefaults(defineProps<{
  theme?: ThemeCard | null
  disabled?: boolean
}>(), {
  theme: null,
  disabled: false
})

const emit = defineEmits<{ open: [] }>()
</script>

<template>
  <button
    type="button"
    :disabled="disabled"
    class="flex w-full items-center gap-3.5 rounded-md border border-subtle bg-surface p-3 text-left shadow-card transition-colors duration-150 enabled:hover:border-strong disabled:opacity-55"
    @click="emit('open')"
  >
    <ArtSlot
      :src="theme ? themeThumb(theme.id) : null"
      :alt="theme?.label ?? ''"
      :monogram="theme?.label ?? '?'"
      class="size-16 shrink-0 rounded-sm border border-subtle"
    />

    <span class="min-w-0 flex-1">
      <span class="block font-mono text-caption uppercase tracking-caps text-tertiary">Dossier thématique</span>
      <span class="mt-0.5 flex items-center gap-1.5">
        <Lock v-if="theme && !theme.unlocked" :size="12" class="shrink-0 text-amber-4" />
        <span class="truncate font-display text-title uppercase tracking-caps text-primary">
          {{ theme?.label ?? 'À choisir' }}
        </span>
      </span>
      <span class="mt-0.5 line-clamp-1 block text-body-s text-secondary">
        {{ theme?.tagline ?? 'Ouvre la vitrine et choisis le terrain de la mission.' }}
      </span>
    </span>

    <ChevronRight :size="18" class="shrink-0 text-tertiary" />
  </button>
</template>
