<script setup lang="ts">
import { onMounted } from 'vue'
import { createGame, type GameConfig } from '~/composables/useGame'
import { createDailyWords } from '~/composables/useDailyWords'
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

const runtimeConfig = useRuntimeConfig()
const words = createDailyWords({ apiBase: runtimeConfig.public.apiBase })
const {
  status: wordsStatus,
  remaining,
  total,
  nextPair,
  refresh: refreshWords,
  consume: consumeWord
} = words

// Client uniquement : fetch de l'API + lecture du localStorage.
onMounted(() => {
  void refreshWords()
})

const music = useBackgroundMusic()

function start(config: GameConfig) {
  const pair = nextPair.value
  if (!pair) return
  if (configure(config, pair)) {
    // La partie démarre vraiment : le crédit est consommé maintenant, jamais
    // sur une config invalide.
    consumeWord()
    // Le clic est le geste utilisateur qui débloque l'autoplay du navigateur.
    void music.start()
  }
}

// Rejouer est une nouvelle partie : nouveau crédit, nouvelle paire.
function replay() {
  const pair = consumeWord()
  if (pair) replaySameTeam(pair)
}
</script>

<template>
  <SetupScreen
    v-if="phase === 'setup'"
    :error="error"
    :words-status="wordsStatus"
    :remaining="wordsStatus === 'ready' ? remaining : null"
    :total="total"
    @start="start"
    @retry="refreshWords"
  />

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
    :can-replay="remaining > 0"
    @replay="replay"
    @new-game="newGame"
  />
</template>
