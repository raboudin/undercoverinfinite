<script setup lang="ts">
import { createGame, type GameConfig } from '~/composables/useGame'
import { useBackgroundMusic } from '~/composables/useBackgroundMusic'

// Déstructuré pour que le template profite du déballage automatique des refs.
const {
  phase,
  players,
  round,
  revealIndex,
  speakerIndex,
  lastEliminated,
  winner,
  error,
  alivePlayers,
  currentRevealPlayer,
  isLastReveal,
  speakingOrder,
  currentSpeaker,
  configure,
  nextReveal,
  nextSpeaker,
  eliminate,
  resolveElimination,
  replaySameTeam,
  newGame
} = createGame()

const music = useBackgroundMusic()

function start(config: GameConfig) {
  // Le clic est le geste utilisateur qui débloque l'autoplay du navigateur.
  if (configure(config)) void music.start()
}
</script>

<template>
  <SetupScreen v-if="phase === 'setup'" :error="error" @start="start" />

  <RevealScreen
    v-else-if="phase === 'reveal' && currentRevealPlayer"
    :player="currentRevealPlayer"
    :index="revealIndex"
    :total="players.length"
    :is-last="isLastReveal"
    @next="nextReveal"
  />

  <DescribeScreen
    v-else-if="phase === 'describe' && currentSpeaker"
    :round="round"
    :speaker="currentSpeaker"
    :order="speakingOrder"
    :speaker-index="speakerIndex"
    @next="nextSpeaker"
  />

  <VoteScreen
    v-else-if="phase === 'vote'"
    :round="round"
    :candidates="alivePlayers"
    @eliminate="eliminate"
  />

  <EliminationScreen
    v-else-if="phase === 'elimination' && lastEliminated"
    :player="lastEliminated"
    @next="resolveElimination"
  />

  <VictoryScreen
    v-else-if="phase === 'victory' && winner"
    :winner="winner"
    :players="players"
    @replay="replaySameTeam"
    @new-game="newGame"
  />
</template>
