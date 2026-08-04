<script setup lang="ts">
import { Lock } from '@lucide/vue'
import type { ModeCard, ModeId } from '../../composables/useEntitlements'
import { modeArt } from '../../utils/gameArt'

withDefaults(defineProps<{ modes?: ModeCard[] }>(), {
  modes: () => []
})

// Présentationnel comme les autres écrans de jeu : un mode verrouillé remonte
// l'information, c'est la page qui décide d'ouvrir la boutique.
const emit = defineEmits<{ locked: [ModeId] }>()

const selected = defineModel<ModeId>({ default: 'classique' })

function choose(mode: ModeCard) {
  if (!mode.unlocked) {
    emit('locked', mode.id)
    return
  }
  // Débloqué mais pas encore écrit (teams) : on ne le sélectionne pas non plus.
  if (!mode.playable) return
  selected.value = mode.id
}
</script>

<template>
  <div class="grid grid-cols-2 gap-3">
    <button
      v-for="mode in modes"
      :key="mode.id"
      type="button"
      :aria-pressed="selected === mode.id"
      :class="[
        'overflow-hidden rounded-md border bg-surface text-left transition-colors duration-150',
        selected === mode.id ? 'border-blue-4 shadow-glow-recon' : 'border-subtle shadow-card',
        mode.playable ? 'cursor-pointer' : 'cursor-default'
      ]"
      @click="choose(mode)"
    >
      <ArtSlot
        :src="modeArt(mode.id)"
        :alt="mode.label"
        :monogram="mode.label"
        class="aspect-video w-full"
        :class="mode.playable ? '' : 'opacity-45'"
      />

      <span class="block p-3">
        <span class="flex items-center gap-1.5">
          <Lock v-if="!mode.unlocked" :size="12" class="shrink-0 text-amber-4" />
          <span
            class="truncate font-display text-body uppercase tracking-caps"
            :class="mode.playable ? 'text-primary' : 'text-secondary'"
          >{{ mode.label }}</span>
        </span>
        <span class="mt-1 block font-mono text-caption leading-snug text-tertiary">{{ mode.tagline }}</span>
        <span v-if="!mode.unlocked" class="mt-1.5 block font-mono text-caption uppercase tracking-caps text-amber-4">
          À débloquer
        </span>
        <span v-else-if="!mode.available" class="mt-1.5 block font-mono text-caption uppercase tracking-caps text-amber-4">
          Bientôt
        </span>
      </span>
    </button>
  </div>
</template>
