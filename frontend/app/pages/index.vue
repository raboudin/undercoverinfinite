<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { createGame, type GameConfig, type WordPair } from '~/composables/useGame'
import type { ThemeId } from '~/composables/useEntitlements'
import { useBackgroundMusic } from '~/composables/useBackgroundMusic'
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
  names,
  undercoverCount,
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
  modes,
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

/** DIY n'est pas un mode de jeu mais une source de mots : il sort de la grille. */
const playableModes = computed(() => modeCards.value.filter(mode => mode.id !== 'diy'))
/**
 * Une partie DIY n'appelle pas l'API — elle ne consomme ni crédit ni mots. Le
 * verrou est donc purement local : ce que le joueur y gagne (écrire ses mots)
 * ne coûte rien au serveur, il n'y a rien à protéger côté API.
 */
const diyUnlocked = computed(() => modes.value.includes('diy'))

const drawing = computed(() => wordsStatus.value === 'drawing')
const canReplay = computed(() => lastRequest.value !== null && credits.value.remaining > 0)

/** Ce qui a servi à lancer la partie, pour pouvoir la rejouer à l'identique. */
const lastRequest = ref<{ theme: ThemeId, custom: WordPair | null } | null>(null)

/**
 * Récupère les mots d'une partie : saisie manuelle, ou tirage serveur — qui
 * débite le crédit et peut renvoyer un défi.
 */
async function fetchSetup(submission: { config: GameConfig, theme: ThemeId, custom: WordPair | null }) {
  if (submission.custom) return { pair: submission.custom, challenge: null }

  const draw = await words.draw(submission.config.mode, submission.theme)
  if (!draw) return null

  // Le serveur fait autorité sur le solde : on prend le sien plutôt que de
  // décrémenter dans notre coin.
  applyCredits(draw.credits)
  return { pair: draw.pair, challenge: draw.challenge }
}

async function start(submission: SetupSubmission) {
  const setup = await fetchSetup(submission)
  if (!setup) return

  if (configure(submission.config, setup)) {
    lastRequest.value = { theme: submission.theme, custom: submission.custom }
    // Le clic est le geste utilisateur qui débloque l'autoplay du navigateur.
    void music.start()
  }
}

// Rejouer est une nouvelle partie : nouveaux mots, donc nouvelle mission
// consommée — sauf en DIY, où l'équipe reprend ses propres mots et où rien
// n'est débité. Le mode et l'équipe, eux, ne bougent pas.
async function replay() {
  const previous = lastRequest.value
  if (!previous) return

  const setup = await fetchSetup({
    config: { names: names.value, undercoverCount: undercoverCount.value, mode: mode.value },
    theme: previous.theme,
    custom: previous.custom
  })
  if (setup) replaySameTeam(setup)
}
</script>

<template>
  <SetupScreen
    v-if="phase === 'setup'"
    :error="error"
    :modes="playableModes"
    :themes="themeCards"
    :diy-unlocked="diyUnlocked"
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
    :can-replay="canReplay"
    :settlement="settlement"
    @replay="replay"
    @new-game="newGame"
  />
</template>
