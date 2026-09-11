<script setup lang="ts">
import { computed, ref } from 'vue'
import { Eye } from '@lucide/vue'
import type { OnlinePlayer } from '../../composables/useRoomSocket'
import type { TableSeat } from '../game/GameTable.vue'

const props = defineProps<{
  players: OnlinePlayer[]
  viewerPlayerId: string
}>()

const emit = defineEmits<{ ack: [] }>()

/**
 * Contrairement au `RevealScreen` local (un seul appareil qui fait défiler
 * la carte de CHAQUE joueur), ici chacun ne voit jamais que la sienne — le
 * serveur ne lui envoie de toute façon que son propre mot (voir redaction).
 */
const revealed = ref(false)
const acked = ref(false)

const viewer = computed<OnlinePlayer | null>(
  () => props.players.find(player => player.id === props.viewerPlayerId) ?? null
)

const waitingFor = computed(
  () => props.players.filter(player => player.alive && !player.hasSeenReveal).length
)

const seats = computed<TableSeat[]>(() =>
  props.players.map(player => ({
    id: player.id,
    name: player.displayName,
    state: player.id === props.viewerPlayerId ? 'active' : 'idle',
    faceUp: player.id === props.viewerPlayerId && revealed.value,
    revealing: player.id === props.viewerPlayerId && revealed.value,
    word: player.id === props.viewerPlayerId ? player.word : null,
    disabled: player.id !== props.viewerPlayerId || acked.value
  }))
)

function open() {
  revealed.value = true
}

function ack() {
  acked.value = true
  emit('ack')
}
</script>

<template>
  <div v-if="viewer" class="flex flex-col gap-5">
    <div class="flex items-center justify-between">
      <span class="font-display text-body-s uppercase tracking-caps text-tertiary">Distribution des dossiers</span>
      <span class="font-mono text-caption text-secondary">
        {{ players.length - waitingFor }} / {{ players.length }} prêts
      </span>
    </div>

    <GameTable
      :seats="seats"
      selectable
      :selected-id="viewer.id"
      action-label="Retourner ma carte"
      @select="open"
    >
      <div class="font-display text-body uppercase tracking-caps text-primary">{{ viewer.displayName }}</div>
      <div class="mt-1 font-mono text-caption leading-snug text-tertiary">
        {{ revealed ? 'dossier ouvert' : 'à toi de jouer' }}
      </div>
    </GameTable>

    <template v-if="revealed">
      <Card glow="danger" class="flex flex-col items-center gap-1.5 py-6 text-center">
        <span class="font-mono text-caption uppercase tracking-caps text-tertiary">Ton mot de couverture</span>
        <span class="font-display text-display-m uppercase tracking-caps text-red-4">{{ viewer.word }}</span>
        <p class="mt-1 max-w-xs text-body-s text-secondary">
          Mémorise-le. Ne le prononce jamais à voix haute — il te trahirait.
        </p>
      </Card>

      <Button v-if="!acked" size="l" variant="secondary" class="w-full" @click="ack()">
        C'est mémorisé
      </Button>
      <p v-else class="text-center font-mono text-caption uppercase tracking-caps text-tertiary">
        En attente de {{ waitingFor }} autre{{ waitingFor > 1 ? 's' : '' }} agent{{ waitingFor > 1 ? 's' : '' }}…
      </p>
    </template>

    <template v-else>
      <p class="text-center text-body-s text-secondary">
        Retourne ta carte sans que personne d'autre ne regarde ton écran.
      </p>
      <Button size="l" class="w-full" @click="open()">
        <Eye :size="18" />
        Retourner ma carte
      </Button>
    </template>
  </div>
</template>
