<script setup lang="ts">
import { computed } from 'vue'
import type { DifficultyCard, DifficultyId } from '../../composables/useEntitlements'

/**
 * Curseur à 5 crans (Évident → Farfelu) : plus la valeur monte, plus la paire
 * de mots tirée pour la partie est sémantiquement éloignée. Purement
 * présentationnel — les libellés viennent du catalogue serveur, jamais
 * inventés ici (même principe que `ThemeButton`).
 */
const props = withDefaults(defineProps<{
  difficulties?: DifficultyCard[]
}>(), {
  difficulties: () => []
})

const selected = defineModel<DifficultyId>({ default: 'normal' })

const current = computed(() => props.difficulties.find(d => d.id === selected.value) ?? null)

function select(level: number) {
  const match = props.difficulties.find(d => d.level === level)
  if (match) selected.value = match.id
}
</script>

<template>
  <div class="flex flex-col gap-2">
    <div class="flex items-center justify-between gap-2">
      <button
        v-for="d in difficulties"
        :key="d.id"
        type="button"
        :aria-label="d.label"
        :aria-pressed="d.id === selected"
        class="h-2 flex-1 rounded-pill transition-colors duration-150"
        :class="d.id === selected ? 'bg-red-4' : 'bg-ink-5'"
        @click="select(d.level)"
      />
    </div>
    <p v-if="current" class="text-center font-mono text-caption text-tertiary">
      {{ current.label }} — {{ current.tagline }}
    </p>
  </div>
</template>
