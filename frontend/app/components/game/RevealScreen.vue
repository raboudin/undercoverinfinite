<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Eye } from '@lucide/vue'
import type { Player } from '../../composables/useGame'
import type { TableSeat } from './GameTable.vue'

const props = defineProps<{
  players: Player[]
  /** Siège dont c'est le tour. */
  index: number
  isLast: boolean
}>()

const emit = defineEmits<{ next: [] }>()

const revealed = ref(false)

const player = computed<Player | null>(() => props.players[props.index] ?? null)

// Le dossier se referme dès que le téléphone change de mains : sans ça, le mot
// du joueur précédent resterait affiché sous les yeux du suivant.
watch(() => player.value?.id, () => {
  revealed.value = false
})

/**
 * Seule la carte de l'agent en poste se retourne — les autres restent face
 * cachée sur la table, et ne sont même pas cliquables.
 */
const seats = computed<TableSeat[]>(() =>
  props.players.map((item, seat) => ({
    id: item.id,
    name: item.name,
    state: seat === props.index ? 'active' : 'idle',
    faceUp: seat === props.index && revealed.value,
    revealing: seat === props.index && revealed.value,
    word: seat === props.index ? item.word : null,
    disabled: seat !== props.index
  }))
)

/**
 * La carte se retourne dans les deux sens : on l'ouvre d'une pression, on la
 * referme de la même. Ouvrir sans pouvoir refermer obligerait à passer le
 * téléphone mot découvert.
 */
function toggle() {
  revealed.value = !revealed.value
}

function open() {
  revealed.value = true
}

function pass() {
  revealed.value = false
  emit('next')
}
</script>

<template>
  <div v-if="player" class="flex flex-col gap-5">
    <div class="flex items-center justify-between">
      <span class="font-display text-body-s uppercase tracking-caps text-tertiary">Distribution des dossiers</span>
      <span class="font-mono text-caption text-secondary">{{ index + 1 }} / {{ players.length }}</span>
    </div>

    <GameTable
      :seats="seats"
      selectable
      :selected-id="player.id"
      action-label="Retourner la carte de"
      @select="toggle"
    >
      <div class="font-display text-body uppercase tracking-caps text-primary">{{ player.name }}</div>
      <div class="mt-1 font-mono text-caption leading-snug text-tertiary">
        {{ revealed ? 'dossier ouvert' : 'prends le téléphone' }}
      </div>
    </GameTable>

    <template v-if="revealed">
      <Card glow="danger" class="flex flex-col items-center gap-1.5 py-6 text-center">
        <span class="font-mono text-caption uppercase tracking-caps text-tertiary">Ton mot de couverture</span>
        <span class="font-display text-display-m uppercase tracking-caps text-red-4">{{ player.word }}</span>
        <p class="mt-1 max-w-xs text-body-s text-secondary">
          Mémorise-le. Ne le prononce jamais à voix haute — il te trahirait.
        </p>
      </Card>

      <Button size="l" variant="secondary" class="w-full" @click="pass()">
        {{ isLast ? 'Tout le monde est briefé' : 'C’est mémorisé — passe le téléphone' }}
      </Button>
    </template>

    <template v-else>
      <p class="text-center text-body-s text-secondary">
        À toi, {{ player.name }}. Retourne ta carte sans que personne ne regarde par-dessus ton épaule.
      </p>
      <Button size="l" class="w-full" @click="open()">
        <Eye :size="18" />
        Retourner ma carte
      </Button>
    </template>
  </div>
</template>
