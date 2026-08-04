<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Target, Timer } from '@lucide/vue'
import type { Player } from '../../composables/useGame'
import type { TableSeat } from './GameTable.vue'

const props = withDefaults(defineProps<{
  round: number
  speaker: Player
  /** Toute la table, dans l'ordre des sièges. */
  players: Player[]
  /** Ordre de parole de la manche : il tourne, contrairement aux sièges. */
  order: Player[]
  speakerIndex: number
  /** Mode chrono : la parole est minutée. */
  timed?: boolean
  timerSeconds?: number
  /** Mode défi : la contrainte tenue par toute la table. */
  challenge?: string | null
}>(), {
  timed: false,
  timerSeconds: 30,
  challenge: null
})

const emit = defineEmits<{ next: [] }>()

const isLastSpeaker = computed(() => props.speakerIndex === props.order.length - 1)
const progress = computed(() => (props.speakerIndex + 1) / props.order.length)

/**
 * L'ordre de parole tourne d'une manche à l'autre alors que les sièges, eux,
 * ne bougent pas : annoncer le suivant évite d'avoir à le chercher sur la table.
 */
const nextSpeaker = computed(() => props.order[props.speakerIndex + 1] ?? null)

/** L'orateur s'allume à sa place ; les grillés gardent leur carte retournée. */
const seats = computed<TableSeat[]>(() =>
  props.players.map(player => ({
    id: player.id,
    name: player.name,
    state: !player.alive ? 'eliminated' : player.id === props.speaker.id ? 'active' : 'idle',
    faceUp: !player.alive,
    word: player.alive ? null : player.word
  }))
)

const remaining = ref(props.timerSeconds)
let ticker: ReturnType<typeof setInterval> | null = null

function stopTimer() {
  if (ticker !== null) {
    clearInterval(ticker)
    ticker = null
  }
}

/**
 * Le minuteur repart de zéro à chaque orateur — d'où la surveillance de
 * `speakerIndex` et non un simple `onMounted` : le composant reste monté d'un
 * agent à l'autre.
 */
function restartTimer() {
  stopTimer()
  if (!props.timed) return
  remaining.value = props.timerSeconds
  ticker = setInterval(() => {
    remaining.value -= 1
    // Temps écoulé : on passe la main sans attendre. L'orateur suivant
    // relancera le minuteur par le `watch`.
    if (remaining.value <= 0) {
      stopTimer()
      emit('next')
    }
  }, 1000)
}

watch(
  () => [props.speakerIndex, props.round, props.timed, props.timerSeconds],
  restartTimer,
  { immediate: true }
)

onBeforeUnmount(stopTimer)

const timeProgress = computed(() =>
  props.timerSeconds > 0 ? Math.max(remaining.value, 0) / props.timerSeconds : 0
)
/** Dernier quart : le minuteur passe au rouge. */
const timeCritical = computed(() => timeProgress.value <= 0.25)
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex items-center justify-between">
      <span class="font-display text-body-s uppercase tracking-caps text-tertiary">Manche {{ round }} — transmission</span>
      <span class="font-mono text-caption text-secondary">{{ speakerIndex + 1 }} / {{ order.length }}</span>
    </div>

    <Card v-if="challenge" glow="danger" class="flex items-start gap-3">
      <Target :size="16" class="mt-0.5 shrink-0 text-amber-4" />
      <div>
        <div class="font-display text-caption uppercase tracking-caps text-amber-4">Défi de la mission</div>
        <p class="mt-1 text-body-s text-secondary">{{ challenge }}</p>
      </div>
    </Card>

    <GameTable :seats="seats">
      <div class="font-display text-body uppercase tracking-caps text-primary">{{ speaker.name }}</div>
      <div class="mt-1 font-mono text-caption leading-snug text-tertiary">à toi de parler</div>
    </GameTable>

    <p class="text-center text-body-s text-secondary">
      Donne un seul mot en lien avec ta couverture. Assez précis pour prouver que tu es loyal,
      assez vague pour ne pas te griller.
    </p>

    <div v-if="timed" class="flex items-center gap-3">
      <Timer :size="16" :class="timeCritical ? 'shrink-0 text-red-4' : 'shrink-0 text-secondary'" />
      <div class="flex-1">
        <ProgressTimer
          :pct="timeProgress"
          :danger="timeCritical"
          :label="`${Math.max(remaining, 0)}s`"
        />
      </div>
    </div>
    <ProgressTimer v-else :pct="progress" label="TOUR DE PAROLE" />

    <p v-if="nextSpeaker" class="text-center font-mono text-caption uppercase tracking-caps text-tertiary">
      Ensuite : {{ nextSpeaker.name }}
    </p>

    <Button size="l" class="w-full" @click="emit('next')">
      {{ isLastSpeaker ? 'Ouvrir le vote' : 'Agent suivant' }}
    </Button>
  </div>
</template>
