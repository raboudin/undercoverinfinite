<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { createGame } from '~/composables/useGame'
import type { DifficultyId, ThemeId } from '~/composables/useEntitlements'
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

const nuxtApp = useNuxtApp()
const entitlements = nuxtApp.$entitlements
const words = nuxtApp.$words

const { status: rightsStatus, themeCards, difficultyCards, refresh: refreshRights } = entitlements
const { status: wordsStatus, error: wordsError } = words

// Client uniquement : le catalogue n'a pas besoin du rendu serveur, mais
// autant rester cohérent avec les autres plugins ($auth) qui, eux, en ont besoin.
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
const canReplay = computed(() => lastTeam.value !== null)

/** Réglages qui ont servi à lancer la partie, pour pouvoir la rejouer. */
const lastTeam = ref<{ theme: ThemeId, spicy: boolean, difficulty: DifficultyId } | null>(null)

async function start(submission: SetupSubmission) {
  const draw = await words.draw(submission.theme, submission.spicy, submission.difficulty)
  if (!draw) return

  if (configure(submission.config, { pair: draw.pair })) {
    lastTeam.value = { theme: submission.theme, spicy: submission.spicy, difficulty: submission.difficulty }
    // Le clic est le geste utilisateur qui débloque l'autoplay du navigateur.
    void music.start()
  }
}

// Rejouer est une nouvelle partie : nouveaux mots, donc un nouveau tirage.
// Le dossier thématique, le registre et la difficulté, eux, ne bougent pas.
async function replay() {
  const team = lastTeam.value
  if (!team) return

  const draw = await words.draw(team.theme, team.spicy, team.difficulty)
  if (!draw) return

  replaySameTeam({ pair: draw.pair })
}
</script>

<template>
  <SetupScreen
    v-if="phase === 'setup'"
    :error="error"
    :themes="themeCards"
    :difficulties="difficultyCards"
    :status="rightsStatus"
    :drawing="drawing"
    :words-error="wordsError"
    @start="start"
    @retry="refreshRights"
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
    @next="nextSpeaker"
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
    @replay="replay"
    @new-game="newGame"
  />
</template>
