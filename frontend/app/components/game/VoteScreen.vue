<script setup lang="ts">
import { ref } from 'vue'
import type { Player } from '../../composables/useGame'

defineProps<{
  round: number
  candidates: Player[]
}>()

const emit = defineEmits<{ eliminate: [string] }>()

const target = ref<Player | null>(null)

function confirm() {
  if (!target.value) return
  emit('eliminate', target.value.id)
  target.value = null
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex items-center justify-between">
      <span class="font-display text-body-s uppercase tracking-caps text-tertiary">Manche {{ round }} — vote</span>
      <span class="font-mono text-caption text-secondary">{{ candidates.length }} suspects</span>
    </div>

    <Card class="flex flex-col gap-2 text-center">
      <div class="font-display text-display-s uppercase tracking-caps text-red-4">Qui grille-t-on ?</div>
      <p class="text-body-s text-secondary">
        Débattez à voix haute, puis désignez ensemble l’agent que vous pensez infiltré. Une seule accusation par manche.
      </p>
    </Card>

    <div class="flex flex-col gap-2">
      <PlayerRow
        v-for="player in candidates"
        :key="player.id"
        :name="player.name"
        status="active"
        action-label="ACCUSER"
        @action="target = player"
      />
    </div>

    <Modal :open="!!target" title="Confirmer l’accusation" @close="target = null">
      <p class="mb-4 max-w-xs text-body-s text-secondary">
        Désigner {{ target?.name }} comme agent double ? Cette décision est irréversible.
      </p>
      <div class="flex gap-2.5">
        <Button variant="ghost" @click="target = null">Annuler</Button>
        <Button variant="danger" @click="confirm()">Désigner cet agent</Button>
      </div>
    </Modal>
  </div>
</template>
