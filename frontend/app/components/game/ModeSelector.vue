<script setup lang="ts">
import { Lock } from '@lucide/vue'
import type { ModeId } from '../../composables/useEntitlements'

/**
 * Mode tel que le sert `useEntitlements.modeCards` : le catalogue serveur,
 * enrichi de l'état de déblocage du joueur.
 */
export interface ModeChoice {
  id: ModeId
  label: string
  tagline: string
  available: boolean
  spicy?: boolean
  unlocked: boolean
  playable: boolean
}

withDefaults(defineProps<{ modes?: ModeChoice[] }>(), {
  modes: () => []
})

// Présentationnel comme les autres écrans de jeu : un mode verrouillé remonte
// l'information, c'est la page qui décide d'ouvrir la boutique.
const emit = defineEmits<{ locked: [ModeId] }>()

const selected = defineModel<ModeId>({ default: 'classique' })

function choose(mode: ModeChoice) {
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
  <Card class="flex flex-col gap-3">
    <div class="font-display text-body-s uppercase tracking-caps text-secondary">Type de mission</div>

    <div class="grid grid-cols-2 gap-2.5">
      <button
        v-for="mode in modes"
        :key="mode.id"
        type="button"
        :aria-pressed="selected === mode.id"
        :class="[
          'flex flex-col gap-1 rounded-sm border p-3 text-left transition-colors duration-150',
          selected === mode.id
            ? 'border-strong bg-surface-inset shadow-glow-recon'
            : 'border-subtle bg-surface-inset',
          mode.playable ? 'cursor-pointer' : 'cursor-default opacity-55'
        ]"
        @click="choose(mode)"
      >
        <span class="flex items-center gap-1.5">
          <Lock v-if="!mode.unlocked" :size="12" class="shrink-0 text-amber-4" />
          <span class="font-display text-body-s uppercase tracking-caps text-primary">{{ mode.label }}</span>
        </span>
        <span class="font-mono text-caption leading-snug text-tertiary">{{ mode.tagline }}</span>
        <span v-if="mode.unlocked && !mode.available" class="font-mono text-caption text-amber-4">Bientôt</span>
        <span v-else-if="!mode.unlocked" class="font-mono text-caption text-amber-4">À débloquer</span>
      </button>
    </div>
  </Card>
</template>
