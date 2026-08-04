<script setup lang="ts">
import { computed, ref } from 'vue'
import { Coins } from '@lucide/vue'
import type { Bet } from '../../composables/useBets'
import type { Player } from '../../composables/useGame'

const props = withDefaults(defineProps<{
  round: number
  /** Agents encore en poste : tous misent, undercovers compris. */
  players: Player[]
  /** Mise proposée par défaut, reprise d'un agent à l'autre. */
  defaultStake?: number
}>(), {
  defaultStake: 5
})

const emit = defineEmits<{ place: [Bet[]] }>()

// Pass-and-play : un agent mise, passe le téléphone, et ainsi de suite. Une
// grille listant tous les paris d'un coup les rendrait publics avant le vote.
const index = ref(0)
const placed = ref<Bet[]>([])
const target = ref<Player | null>(null)
const stake = ref(props.defaultStake)

const bettor = computed<Player | null>(() => props.players[index.value] ?? null)
const suspects = computed(() =>
  props.players.filter(player => player.id !== bettor.value?.id)
)
const isLast = computed(() => index.value === props.players.length - 1)
const ready = computed(() => target.value !== null && stake.value >= 0)

const pot = computed(() =>
  Math.round(placed.value.reduce((sum, bet) => sum + bet.stake, 0) * 100) / 100
)

function confirm() {
  if (!bettor.value || !target.value) return

  placed.value = [
    ...placed.value,
    { playerId: bettor.value.id, targetId: target.value.id, stake: stake.value }
  ]
  target.value = null

  if (isLast.value) {
    emit('place', placed.value)
    return
  }
  index.value += 1
}
</script>

<template>
  <div v-if="bettor" class="flex flex-col gap-6">
    <div class="flex items-center justify-between">
      <span class="font-display text-body-s uppercase tracking-caps text-tertiary">Manche {{ round }} — paris</span>
      <span class="font-mono text-caption text-secondary">{{ index + 1 }} / {{ players.length }}</span>
    </div>

    <Card glow="danger" class="flex flex-col items-center gap-3 py-7 text-center">
      <Coins :size="28" class="text-amber-4" />
      <div class="font-display text-display-s uppercase tracking-caps text-primary">{{ bettor.name }}</div>
      <p class="max-w-xs text-body-s text-secondary">
        Mise sur l’agent que tu crois infiltré. Si tu vois juste, tu récupères ta mise et une part de celles des autres.
      </p>
      <p class="font-mono text-caption text-tertiary">
        Les autres, ne regardez pas.
      </p>
    </Card>

    <Card class="flex items-center justify-between gap-4">
      <div>
        <div class="font-display text-body-s uppercase tracking-caps text-secondary">Ta mise</div>
        <div class="mt-0.5 font-mono text-caption text-tertiary">déjà sur la table : {{ pot }}</div>
      </div>
      <input
        v-model.number="stake"
        type="number"
        min="0"
        step="0.5"
        inputmode="decimal"
        aria-label="Montant de ta mise"
        class="w-24 rounded-sm border border-subtle bg-surface-inset px-3 py-2.5 text-right font-mono text-body text-primary focus:border-strong focus:outline-none focus:ring-1 focus:ring-focus-ring"
      >
    </Card>

    <div class="flex flex-col gap-2">
      <div class="font-display text-body-s uppercase tracking-caps text-tertiary">Ton suspect</div>
      <div
        v-for="player in suspects"
        :key="player.id"
        class="rounded-sm transition-shadow duration-150"
        :class="target?.id === player.id ? 'shadow-glow-danger' : ''"
      >
        <PlayerRow
          :name="player.name"
          status="active"
          :action-label="target?.id === player.id ? 'CHOISI' : 'MISER'"
          @action="target = player"
        />
      </div>
    </div>

    <p class="text-center font-mono text-caption text-tertiary">
      L’app tient les comptes. Elle ne gère aucun paiement : réglez-vous entre vous.
    </p>

    <Button size="l" class="w-full" :disabled="!ready" @click="confirm()">
      {{ isLast ? 'Ouvrir le vote' : 'Agent suivant' }}
    </Button>
  </div>
</template>
