<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { createGame, type GameConfig } from '~/composables/useGame'
import type { ThemeId } from '~/composables/useEntitlements'
import { useBackgroundMusic } from '~/composables/useBackgroundMusic'
import { useMissionExit } from '~/composables/useMissionExit'
import type { SetupSubmission } from '~/components/game/SetupScreen.vue'

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
  mode,
  timerSeconds,
  challenge,
  alivePlayers,
  currentRevealPlayer,
  isLastReveal,
  speakingOrder,
  currentSpeaker,
  isTimed,
  settlement,
  configure,
  nextReveal,
  nextSpeaker,
  placeBets,
  eliminate,
  resolveElimination,
  replaySameTeam,
  newGame
} = createGame()

const nuxtApp = useNuxtApp()
const entitlements = nuxtApp.$entitlements
const words = nuxtApp.$words

const {
  status: rightsStatus,
  credits,
  modeCards,
  themeCards,
  applyCredits,
  refresh: refreshRights
} = entitlements
const { status: wordsStatus, error: wordsError, errorKind: wordsErrorKind } = words

// Client uniquement : les droits dépendent de cookies que le rendu serveur ne
// relaie pas.
onMounted(() => {
  if (rightsStatus.value !== 'ready') void refreshRights()
})

const music = useBackgroundMusic()

// Le logo de l'en-tête rappelle la table au menu, quelle que soit la phase.
const missionExit = useMissionExit()
watch(missionExit, () => {
  if (phase.value !== 'setup') newGame()
})

const drawing = computed(() => wordsStatus.value === 'drawing')
const canReplay = computed(() => lastTheme.value !== null && credits.value.remaining > 0)

/** Le dossier qui a servi à lancer la partie, pour pouvoir la rejouer. */
const lastTheme = ref<ThemeId | null>(null)

async function start(submission: SetupSubmission) {
  const draw = await words.draw(submission.config.mode, submission.theme)
  if (!draw) return

  // Le serveur fait autorité sur le solde : on prend le sien plutôt que de
  // décrémenter dans notre coin.
  applyCredits(draw.credits)

  if (configure(submission.config, { pair: draw.pair, challenge: draw.challenge })) {
    lastTheme.value = submission.theme
    // Le clic est le geste utilisateur qui débloque l'autoplay du navigateur.
    void music.start()
  }
}

// Rejouer est une nouvelle partie : nouveaux mots, donc nouvelle mission
// consommée. Le mode et l'équipe, eux, ne bougent pas.
async function replay() {
  const theme = lastTheme.value
  if (!theme) return

  const draw = await words.draw(mode.value, theme)
  if (!draw) return

  applyCredits(draw.credits)
  replaySameTeam({ pair: draw.pair, challenge: draw.challenge })
}
</script>

<template>
  <SetupScreen
    v-if="phase === 'setup'"
    :error="error"
    :modes="modeCards"
    :themes="themeCards"
    :status="rightsStatus"
    :credits="rightsStatus === 'ready' ? credits : null"
    :drawing="drawing"
    :words-error="wordsError"
    :words-error-kind="wordsErrorKind"
    @start="start"
    @retry="refreshRights"
    @boutique="navigateTo('/boutique')"
  />

  <RevealScreen
    v-else-if="phase === 'reveal' && currentRevealPlayer"
    :players="players"
    :index="revealIndex"
    :is-last="isLastReveal"
    @next="nextReveal"
  />

  <DescribeScreen
    v-else-if="phase === 'describe' && currentSpeaker"
    :round="round"
    :speaker="currentSpeaker"
    :players="players"
    :order="speakingOrder"
    :speaker-index="speakerIndex"
    :timed="isTimed"
    :timer-seconds="timerSeconds"
    :challenge="challenge"
    @next="nextSpeaker"
  />

  <BetScreen
    v-else-if="phase === 'bets'"
    :round="round"
    :players="alivePlayers"
    @place="placeBets"
  />

  <VoteScreen
    v-else-if="phase === 'vote'"
    :round="round"
    :players="players"
    @eliminate="eliminate"
  />

  <EliminationScreen
    v-else-if="phase === 'elimination' && lastEliminated"
    :player="lastEliminated"
    :players="players"
    @next="resolveElimination"
  />

  <VictoryScreen
    v-else-if="phase === 'victory' && winner"
    :winner="winner"
    :players="players"
    :can-replay="canReplay"
    :settlement="settlement"
    @replay="replay"
    @new-game="newGame"
  />
</template>
