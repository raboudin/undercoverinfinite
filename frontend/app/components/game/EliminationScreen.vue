<script setup lang="ts">
import { computed, ref } from 'vue'
import { RotateCcw } from '@lucide/vue'
import type { Player } from '../../composables/useGame'
import type { TableSeat } from './GameTable.vue'

const props = defineProps<{
  /** L'agent que la table vient de désigner. */
  player: Player
  players: Player[]
}>()

defineEmits<{ next: [] }>()

/**
 * La carte ne se retourne pas toute seule : quelqu'un la retourne, comme sur
 * une vraie table. C'est ce geste qui fait le moment.
 */
const revealed = ref(false)

const seats = computed<TableSeat[]>(() =>
  props.players.map(item => ({
    id: item.id,
    name: item.name,
    state: item.alive ? 'idle' : 'eliminated',
    // Les cartes déjà retournées aux manches précédentes restent visibles ; celle
    // du jour attend le geste.
    faceUp: !item.alive && (item.id !== props.player.id || revealed.value),
    word: item.alive ? null : item.word,
    disabled: item.id !== props.player.id || revealed.value
  }))
)
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="font-display text-body-s uppercase tracking-caps text-tertiary">Couverture grillée</div>

    <GameTable
      :seats="seats"
      selectable
      :selected-id="player.id"
      action-label="Retourner la carte de"
      @select="revealed = true"
    >
      <div class="font-display text-body uppercase tracking-caps text-primary line-through">{{ player.name }}</div>
      <div class="mt-1 font-mono text-caption leading-snug text-tertiary">
        {{ revealed ? 'carte retournée' : 'carte face cachée' }}
      </div>
    </GameTable>

    <template v-if="revealed">
      <!--
        Le mot, et rien que le mot. Dire ici « agent double » ou « agent loyal »
        remettrait la réponse sur la table et retirerait au débat sa raison
        d'être : à la table de recouper.
      -->
      <Card class="flex flex-col items-center gap-1.5 py-6 text-center">
        <span class="font-mono text-caption uppercase tracking-caps text-tertiary">Son mot de couverture</span>
        <span class="font-display text-display-m uppercase tracking-caps text-secondary">{{ player.word }}</span>
        <p class="mt-1 max-w-xs text-body-s text-secondary">
          Le QG n’en dira pas plus. À vous de recouper.
        </p>
      </Card>

      <Button size="l" class="w-full" @click="$emit('next')">Continuer</Button>
    </template>

    <template v-else>
      <p class="text-center text-body-s text-secondary">
        {{ player.name }} est grillé. Retournez sa carte devant toute la table.
      </p>
      <Button size="l" variant="danger" class="w-full" @click="revealed = true">
        <RotateCcw :size="18" />
        Retourner sa carte
      </Button>
    </template>
  </div>
</template>
