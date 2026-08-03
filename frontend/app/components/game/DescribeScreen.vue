<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { Target, Timer } from '@lucide/vue'
import type { Player } from '../../composables/useGame'

const props = withDefaults(defineProps<{
  round: number
  speaker: Player
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

    <Card glow="recon" class="flex flex-col items-center gap-4 py-8 text-center">
      <Avatar :initial="speaker.name[0]" status="online" :size="64" />
      <div class="font-display text-display-s uppercase tracking-caps text-primary">{{ speaker.name }}</div>
      <p class="max-w-xs text-body-s text-secondary">
        À toi. Donne un seul mot en lien avec ta couverture. Assez précis pour prouver que tu es loyal, assez vague pour ne pas te griller.
      </p>
    </Card>

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

    <Button size="l" class="w-full" @click="emit('next')">
      {{ isLastSpeaker ? 'Ouvrir le vote' : 'Agent suivant' }}
    </Button>
  </div>
</template>
