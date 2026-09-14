<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { createRoomSocket, type OnlinePlayer } from '~/composables/useRoomSocket'
import type { Player } from '~/composables/useGame'

const route = useRoute()
const code = computed(() => String(route.params.code ?? '').toUpperCase())

const nuxtApp = useNuxtApp()
const auth = nuxtApp.$auth
const entitlements = nuxtApp.$entitlements
const runtimeConfig = useRuntimeConfig()

const room = createRoomSocket({ apiBase: runtimeConfig.public.apiBase, request: auth.authFetch })

/** `true` dès qu'un jeton de siège existe pour ce code — connu ou tout juste rejoint. */
const hasMembership = ref(false)
const joinName = ref('')
const joining = ref(false)

function membershipKey(): string {
  return `undercover:room:${code.value}`
}

onMounted(() => {
  if (entitlements.status.value !== 'ready') void entitlements.refresh()

  if (typeof localStorage !== 'undefined' && localStorage.getItem(membershipKey())) {
    hasMembership.value = true
    room.connect(code.value)
  }
})

onBeforeUnmount(() => {
  room.disconnect()
})

async function submitJoin() {
  const name = joinName.value.trim()
  if (!name) return
  joining.value = true
  const result = await room.joinRoom(code.value, name)
  joining.value = false
  if (!result) return
  hasMembership.value = true
  room.connect(code.value, result.playerToken)
}

async function leaveToMenu() {
  room.leaveRoom()
  await navigateTo('/')
}

const state = room.state

function playerById(id: string | null | undefined): OnlinePlayer | null {
  if (!id || !state.value) return null
  return state.value.players.find(player => player.id === id) ?? null
}

/**
 * Adapte une vue rédigée (`role`/`word` nullables) vers le type `Player` local
 * qu'attendent `DescribeScreen`/`EliminationScreen`/`VictoryScreen`. Sûr : ces
 * composants n'affichent jamais `role`/`word` pour un agent encore vivant hors
 * victoire, et le serveur ne les laisse alors jamais nuls pour les autres cas
 * (grillé, ou phase victoire) — voir `redaction.ts` côté API.
 */
function toLocalPlayer(player: OnlinePlayer): Player {
  return {
    id: player.id,
    name: player.displayName,
    role: player.role ?? 'civil',
    word: player.word ?? '',
    alive: player.alive
  }
}

const localPlayers = computed<Player[]>(() => (state.value?.players ?? []).map(toLocalPlayer))

const currentSpeaker = computed<OnlinePlayer | null>(() => {
  if (!state.value) return null
  return playerById(state.value.speakingOrder[state.value.speakerIndex] ?? null)
})
const speakingOrderPlayers = computed<OnlinePlayer[]>(() =>
  (state.value?.speakingOrder ?? [])
    .map(id => playerById(id))
    .filter((player): player is OnlinePlayer => !!player)
)
const lastEliminatedPlayer = computed<OnlinePlayer | null>(() =>
  playerById(state.value?.lastEliminatedPlayerId ?? null)
)

const tiedPlayerIds = computed(() =>
  room.lastVoteEvent.value?.type === 'tie' ? room.lastVoteEvent.value.tiedPlayerIds : null
)

const inviteUrl = computed(() =>
  import.meta.client ? `${window.location.origin}/salle/${code.value}` : ''
)

const inputClass
  = 'w-full rounded-sm border border-subtle bg-surface-inset px-3 py-2.5 text-[16px] text-primary '
    + 'placeholder:text-tertiary focus:border-strong focus:outline-none focus:ring-1 focus:ring-focus-ring'
</script>

<template>
  <div v-if="!hasMembership" class="flex flex-col gap-5">
    <div class="flex flex-col items-center gap-2 text-center">
      <span class="font-display text-body-s uppercase tracking-caps text-tertiary">Rejoindre la salle</span>
      <span class="font-display text-display-m uppercase tracking-caps text-primary">{{ code }}</span>
    </div>

    <input
      v-model="joinName"
      :class="inputClass"
      placeholder="Ton nom de code"
      type="text"
      maxlength="24"
      autocomplete="off"
      @keydown.enter.prevent="submitJoin()"
    >

    <Toast v-if="room.error.value" tone="danger">{{ room.error.value }}</Toast>

    <Button size="l" class="w-full" :disabled="joining || !joinName.trim()" @click="submitJoin()">
      {{ joining ? 'Connexion…' : 'Rejoindre' }}
    </Button>
  </div>

  <template v-else-if="state">
    <LobbyScreen
      v-if="state.phase === 'lobby'"
      :code="state.code"
      :invite-url="inviteUrl"
      :players="state.players"
      :viewer-player-id="state.viewerPlayerId"
      :is-host="state.isHost"
      :spicy="state.spicy"
      :difficulty="state.difficulty"
      :undercover-count="state.undercoverCount"
      :difficulties="entitlements.difficultyCards.value"
      @start="room.start()"
      @configure="room.configureRoom($event)"
      @leave="leaveToMenu()"
    />

    <OnlineRevealScreen
      v-else-if="state.phase === 'reveal'"
      :players="state.players"
      :viewer-player-id="state.viewerPlayerId"
      @ack="room.ackReveal()"
    />

    <DescribeScreen
      v-else-if="state.phase === 'describe' && currentSpeaker"
      :round="state.round"
      :speaker="toLocalPlayer(currentSpeaker)"
      :players="localPlayers"
      :order="speakingOrderPlayers.map(toLocalPlayer)"
      :speaker-index="state.speakerIndex"
      @next="room.nextSpeaker()"
    />

    <OnlineVoteScreen
      v-else-if="state.phase === 'vote'"
      :round="state.round"
      :attempt="state.attempt"
      :players="state.players"
      :votes="state.votes"
      :viewer-player-id="state.viewerPlayerId"
      :tied-player-ids="tiedPlayerIds"
      @vote="room.castVote($event)"
    />

    <EliminationScreen
      v-else-if="state.phase === 'elimination' && lastEliminatedPlayer"
      :player="toLocalPlayer(lastEliminatedPlayer)"
      :players="localPlayers"
      @next="room.continueAfterElimination()"
    />

    <VictoryScreen
      v-else-if="state.phase === 'victory' && state.winner"
      :winner="state.winner"
      :players="localPlayers"
      :can-replay="true"
      @replay="room.replay()"
      @new-game="leaveToMenu()"
    />

    <Toast v-if="room.error.value" tone="danger" class="mt-4">{{ room.error.value }}</Toast>
  </template>

  <div v-else class="flex flex-col items-center gap-3 py-16 text-center">
    <p class="text-body-s text-secondary">Connexion à la salle…</p>
    <Toast v-if="room.error.value" tone="danger">{{ room.error.value }}</Toast>
  </div>
</template>
