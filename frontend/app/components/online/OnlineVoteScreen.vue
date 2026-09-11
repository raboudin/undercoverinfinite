<script setup lang="ts">
import { computed } from 'vue'
import type { OnlinePlayer, RoomVoteRow } from '../../composables/useRoomSocket'
import type { TableSeat } from '../game/GameTable.vue'

const props = withDefaults(defineProps<{
  round: number
  attempt: number
  players: OnlinePlayer[]
  /** Votes de la tentative en cours — publics par choix produit, identités comprises. */
  votes: RoomVoteRow[]
  viewerPlayerId: string
  tiedPlayerIds?: string[] | null
}>(), {
  tiedPlayerIds: null
})

const emit = defineEmits<{ vote: [string] }>()

/**
 * Contrairement au `VoteScreen` local (un·e agent tape un nom pour toute la
 * table, consensus déjà fait à voix haute), ici chaque appareil vote pour son
 * propre compte, en simultané — le tableau des voix se remplit en direct.
 */
const candidates = computed(() => props.players.filter(player => player.alive))
const myVote = computed(() => props.votes.find(vote => vote.voterId === props.viewerPlayerId) ?? null)
const hasVoted = computed(() => !!myVote.value)

function nameOf(id: string): string {
  return props.players.find(player => player.id === id)?.displayName ?? '—'
}

function countFor(playerId: string): number {
  return props.votes.filter(vote => vote.targetId === playerId).length
}

const seats = computed<TableSeat[]>(() =>
  props.players.map(player => ({
    id: player.id,
    name: player.displayName,
    state: !player.alive
      ? 'eliminated'
      : myVote.value?.targetId === player.id
        ? 'active'
        : 'idle',
    // Une carte déjà retournée (élimination précédente) le reste, comme en local.
    faceUp: !player.alive,
    word: player.alive ? null : player.word,
    disabled: !player.alive || player.id === props.viewerPlayerId || hasVoted.value
  }))
)

function castVote(id: string) {
  if (hasVoted.value) return
  emit('vote', id)
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <div class="flex items-center justify-between">
      <span class="font-display text-body-s uppercase tracking-caps text-tertiary">
        Manche {{ round }} — vote{{ attempt > 1 ? ` (tentative ${attempt})` : '' }}
      </span>
      <span class="font-mono text-caption text-secondary">{{ votes.length }} / {{ candidates.length }} votes</span>
    </div>

    <Toast v-if="tiedPlayerIds && tiedPlayerIds.length > 0" tone="danger">
      Égalité entre {{ tiedPlayerIds.map(nameOf).join(' et ') }} — nouveau vote.
    </Toast>

    <GameTable
      :seats="seats"
      selectable
      :selected-id="myVote?.targetId ?? null"
      action-label="Voter contre"
      @select="castVote"
    >
      <div class="font-display text-body uppercase tracking-caps text-red-4">Qui grille-t-on ?</div>
      <div class="mt-1 font-mono text-caption leading-snug text-tertiary">
        {{ hasVoted ? 'vote enregistré' : 'touche le siège du suspect' }}
      </div>
    </GameTable>

    <p class="text-center text-body-s text-secondary">
      Chacun vote de son côté, en direct. Une fois posé, un vote ne se change plus.
    </p>

    <div class="flex flex-col gap-2">
      <div
        v-for="player in candidates"
        :key="player.id"
        class="flex items-center justify-between gap-3 rounded-sm border border-subtle bg-surface px-4 py-2.5"
      >
        <span class="truncate text-primary">{{ player.displayName }}</span>
        <span class="font-mono text-caption text-secondary">{{ countFor(player.id) }} voix</span>
      </div>
    </div>
  </div>
</template>
