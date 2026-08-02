<script setup lang="ts">
import { computed } from 'vue'
import type { Player } from '../../composables/useGame'

const props = defineProps<{
  round: number
  speaker: Player
  order: Player[]
  speakerIndex: number
}>()

defineEmits<{ next: [] }>()

const isLastSpeaker = computed(() => props.speakerIndex === props.order.length - 1)
const progress = computed(() => (props.speakerIndex + 1) / props.order.length)
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex items-center justify-between">
      <span class="font-display text-body-s uppercase tracking-caps text-tertiary">Manche {{ round }} — transmission</span>
      <span class="font-mono text-caption text-secondary">{{ speakerIndex + 1 }} / {{ order.length }}</span>
    </div>

    <Card glow="recon" class="flex flex-col items-center gap-4 py-8 text-center">
      <Avatar :initial="speaker.name[0]" status="online" :size="64" />
      <div class="font-display text-display-s uppercase tracking-caps text-primary">{{ speaker.name }}</div>
      <p class="max-w-xs text-body-s text-secondary">
        À toi. Donne un seul mot en lien avec ta couverture. Assez précis pour prouver que tu es loyal, assez vague pour ne pas te griller.
      </p>
    </Card>

    <ProgressTimer :pct="progress" label="TOUR DE PAROLE" />

    <div class="flex flex-col gap-2">
      <div
        v-for="(player, index) in order"
        :key="player.id"
        class="rounded-sm transition-shadow duration-150"
        :class="index === speakerIndex ? 'shadow-glow-recon' : ''"
      >
        <PlayerRow :name="player.name" status="active" />
      </div>
    </div>

    <Button size="l" class="w-full" @click="$emit('next')">
      {{ isLastSpeaker ? 'Ouvrir le vote' : 'Agent suivant' }}
    </Button>
  </div>
</template>
