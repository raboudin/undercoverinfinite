<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Player } from '../../composables/useGame'
import type { TableSeat } from './GameTable.vue'

const props = defineProps<{
  round: number
  /** Toute la table : les grillés gardent leur siège, retourné. */
  players: Player[]
}>()

const emit = defineEmits<{ eliminate: [string] }>()

const target = ref<Player | null>(null)

const candidates = computed(() => props.players.filter(player => player.alive))

const seats = computed<TableSeat[]>(() =>
  props.players.map(player => ({
    id: player.id,
    name: player.name,
    state: player.alive ? (target.value?.id === player.id ? 'active' : 'idle') : 'eliminated',
    // Une carte déjà retournée le reste : elle fait partie des indices.
    faceUp: !player.alive,
    word: player.alive ? null : player.word,
    disabled: !player.alive
  }))
)

function accuse(id: string) {
  target.value = candidates.value.find(player => player.id === id) ?? null
}

function confirm() {
  if (!target.value) return
  emit('eliminate', target.value.id)
  target.value = null
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex items-center justify-between">
      <span class="font-display text-body-s uppercase tracking-caps text-tertiary">Manche {{ round }} — vote</span>
      <span class="font-mono text-caption text-secondary">{{ candidates.length }} suspects</span>
    </div>

    <GameTable
      :seats="seats"
      selectable
      :selected-id="target?.id ?? null"
      action-label="Accuser"
      @select="accuse"
    >
      <div class="font-display text-body uppercase tracking-caps text-red-4">Qui grille-t-on ?</div>
      <div class="mt-1 font-mono text-caption leading-snug text-tertiary">
        touche le siège du suspect
      </div>
    </GameTable>

    <p class="text-center text-body-s text-secondary">
      Débattez à voix haute, puis désignez ensemble l’agent que vous pensez infiltré.
      Une seule accusation par manche.
    </p>

    <Modal :open="!!target" title="Confirmer l’accusation" @close="target = null">
      <p class="mb-4 max-w-xs text-body-s text-secondary">
        Désigner {{ target?.name }} comme agent double ? Sa carte sera retournée devant tout le monde.
      </p>
      <div class="flex gap-2.5">
        <Button variant="ghost" @click="target = null">Annuler</Button>
        <Button variant="danger" @click="confirm()">Retourner sa carte</Button>
      </div>
    </Modal>
  </div>
</template>
