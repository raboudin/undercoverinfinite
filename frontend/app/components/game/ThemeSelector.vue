<script setup lang="ts">
import { Lock } from '@lucide/vue'
import type { ThemeId } from '../../composables/useEntitlements'

/** Thème tel que le sert `useEntitlements.themeCards`. */
export interface ThemeChoice {
  id: ThemeId
  label: string
  generalist: boolean
  unlocked: boolean
}

withDefaults(defineProps<{ themes?: ThemeChoice[] }>(), {
  themes: () => []
})

const emit = defineEmits<{ locked: [ThemeId] }>()

const selected = defineModel<ThemeId>({ default: 'general' })

function choose(theme: ThemeChoice) {
  if (!theme.unlocked) {
    emit('locked', theme.id)
    return
  }
  selected.value = theme.id
}
</script>

<template>
  <Card class="flex flex-col gap-3">
    <div class="font-display text-body-s uppercase tracking-caps text-secondary">Dossier thématique</div>

    <div class="flex flex-wrap gap-2">
      <button
        v-for="theme in themes"
        :key="theme.id"
        type="button"
        :aria-pressed="selected === theme.id"
        :class="[
          'inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 font-display text-caption uppercase tracking-caps transition-colors duration-150',
          selected === theme.id
            ? 'border-blue-4 bg-transparent text-blue-3'
            : 'border-subtle bg-surface-inset text-secondary',
          theme.unlocked ? 'cursor-pointer' : 'cursor-default opacity-55'
        ]"
        @click="choose(theme)"
      >
        <Lock v-if="!theme.unlocked" :size="11" class="shrink-0 text-amber-4" />
        {{ theme.label }}
      </button>
    </div>
  </Card>
</template>
