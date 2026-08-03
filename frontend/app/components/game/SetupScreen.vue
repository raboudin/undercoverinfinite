<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Minus, Plus } from '@lucide/vue'
import {
  DEFAULT_TIMER_SECONDS,
  MAX_PLAYERS,
  MAX_TIMER_SECONDS,
  MIN_PLAYERS,
  MIN_TIMER_SECONDS,
  maxUndercovers,
  type GameConfig,
  type WordPair
} from '../../composables/useGame'
import type {
  Credits,
  EntitlementsStatus,
  ModeId,
  ThemeId
} from '../../composables/useEntitlements'
import type { WordsErrorKind } from '../../composables/useWords'
import type { ModeChoice } from './ModeSelector.vue'
import type { ThemeChoice } from './ThemeSelector.vue'
import logoFull from '../../assets/images/logo-full.png'

export interface SetupSubmission {
  config: GameConfig
  theme: ThemeId
  /** Mots saisis à la main (DIY). `null` = le serveur les fournit. */
  custom: WordPair | null
}

const props = withDefaults(defineProps<{
  error?: string | null
  /** Modes proposés, hors DIY qui n'est pas un mode mais une source de mots. */
  modes?: ModeChoice[]
  themes?: ThemeChoice[]
  /** DIY débloqué (pack infinite). */
  diyUnlocked?: boolean
  status?: EntitlementsStatus
  credits?: Credits | null
  /** Un tirage est en cours côté serveur. */
  drawing?: boolean
  wordsError?: string | null
  wordsErrorKind?: WordsErrorKind | null
}>(), {
  error: null,
  modes: () => [],
  themes: () => [],
  diyUnlocked: false,
  status: 'ready',
  credits: null,
  drawing: false,
  wordsError: null,
  wordsErrorKind: null
})

const emit = defineEmits<{
  start: [SetupSubmission]
  retry: []
  boutique: []
}>()

const names = ref<string[]>(['', '', '', ''])
const undercoverCount = ref(1)
const mode = ref<ModeId>('classique')
const theme = ref<ThemeId>('general')
const timerSeconds = ref(DEFAULT_TIMER_SECONDS)
const useCustomWords = ref(false)
const customA = ref('')
const customB = ref('')

const undercoverCeiling = computed(() => maxUndercovers(names.value.length))
const civilCount = computed(() => names.value.length - undercoverCount.value)

const isTimed = computed(() => mode.value === 'chrono')
const isSpicy = computed(() => props.modes.find(item => item.id === mode.value)?.spicy === true)

// Réduire l'effectif peut rendre le nombre d'undercovers illégal : on le
// ramène sous le plafond plutôt que de laisser passer une config invalide.
watch(undercoverCeiling, ceiling => {
  if (undercoverCount.value > ceiling) undercoverCount.value = ceiling
})

// Perdre le pack (déconnexion) doit refermer la saisie manuelle, sinon
// l'écran promettrait une option que le joueur n'a plus.
watch(() => props.diyUnlocked, unlocked => {
  if (!unlocked) useCustomWords.value = false
})

/**
 * Les mots maison ne coûtent pas de crédit : ils ne demandent ni appel LLM ni
 * tirage. Le quota ne bloque donc pas ce chemin.
 */
const customWordsReady = computed(() => {
  const a = customA.value.trim()
  const b = customB.value.trim()
  return a.length > 0 && b.length > 0 && a.toLocaleLowerCase() !== b.toLocaleLowerCase()
})

const outOfCredits = computed(
  () => props.status === 'ready' && !useCustomWords.value && (props.credits?.remaining ?? 0) === 0
)

const canLaunch = computed(() => {
  if (props.status !== 'ready' || props.drawing) return false
  if (useCustomWords.value) return customWordsReady.value
  return (props.credits?.remaining ?? 0) > 0
})

function setPlayerCount(count: number) {
  if (count < MIN_PLAYERS || count > MAX_PLAYERS) return
  if (count > names.value.length) {
    names.value = [...names.value, ...Array.from({ length: count - names.value.length }, () => '')]
  }
  else {
    names.value = names.value.slice(0, count)
  }
}

function setUndercoverCount(count: number) {
  if (count < 1 || count > undercoverCeiling.value) return
  undercoverCount.value = count
}

function setTimer(seconds: number) {
  if (seconds < MIN_TIMER_SECONDS || seconds > MAX_TIMER_SECONDS) return
  timerSeconds.value = seconds
}

function start() {
  emit('start', {
    config: {
      names: names.value,
      undercoverCount: undercoverCount.value,
      mode: mode.value,
      timerSeconds: timerSeconds.value
    },
    theme: theme.value,
    custom: useCustomWords.value
      ? { a: customA.value.trim(), b: customB.value.trim() }
      : null
  })
}

const inputClass
  = 'w-full rounded-sm border border-subtle bg-surface-inset px-3 py-2.5 text-body text-primary '
    + 'placeholder:text-tertiary focus:border-strong focus:outline-none focus:ring-1 focus:ring-focus-ring'
</script>

<template>
  <div class="flex flex-col gap-7">
    <div class="flex flex-col items-center gap-3">
      <img :src="logoFull" alt="Undercover Infinite" class="w-64 max-w-full object-contain" >
      <p class="text-center text-body-s text-tertiary">
        Un seul téléphone. Passez-le de main en main.<br >
        Un agent double se cache parmi vous.
      </p>
    </div>

    <ModeSelector v-model="mode" :modes="modes" @locked="emit('boutique')" />

    <Card v-if="isTimed" class="flex items-center justify-between gap-4">
      <div>
        <div class="font-display text-body-s uppercase tracking-caps text-secondary">Temps de parole</div>
        <div class="mt-0.5 font-mono text-caption text-tertiary">par agent et par manche</div>
      </div>
      <div class="flex items-center gap-3">
        <IconButton :size="36" aria-label="Réduire le temps de parole" @click="setTimer(timerSeconds - 5)">
          <Minus :size="16" />
        </IconButton>
        <span class="w-12 text-center font-display text-display-s text-primary">{{ timerSeconds }}s</span>
        <IconButton :size="36" aria-label="Augmenter le temps de parole" @click="setTimer(timerSeconds + 5)">
          <Plus :size="16" />
        </IconButton>
      </div>
    </Card>

    <Toast v-if="isSpicy" tone="danger">
      Mode hot : mots réservés à un public adulte.
    </Toast>

    <ThemeSelector v-model="theme" :themes="themes" @locked="emit('boutique')" />

    <Card class="flex flex-col gap-5">
      <div class="flex items-center justify-between gap-4">
        <div>
          <div class="font-display text-body-s uppercase tracking-caps text-secondary">Agents sur le terrain</div>
          <div class="mt-0.5 font-mono text-caption text-tertiary">de {{ MIN_PLAYERS }} à {{ MAX_PLAYERS }}</div>
        </div>
        <div class="flex items-center gap-3">
          <IconButton
            :size="36"
            aria-label="Retirer un agent"
            @click="setPlayerCount(names.length - 1)"
          >
            <Minus :size="16" />
          </IconButton>
          <span class="w-7 text-center font-display text-display-s text-primary">{{ names.length }}</span>
          <IconButton
            :size="36"
            aria-label="Ajouter un agent"
            @click="setPlayerCount(names.length + 1)"
          >
            <Plus :size="16" />
          </IconButton>
        </div>
      </div>

      <div class="h-px bg-subtle" />

      <div class="flex items-center justify-between gap-4">
        <div>
          <div class="font-display text-body-s uppercase tracking-caps text-secondary">Undercovers infiltrés</div>
          <div class="mt-0.5 font-mono text-caption text-tertiary">
            {{ civilCount }} {{ civilCount > 1 ? 'loyaux' : 'loyal' }} · {{ undercoverCount }} infiltré{{ undercoverCount > 1 ? 's' : '' }}
          </div>
        </div>
        <div class="flex items-center gap-3">
          <IconButton
            :size="36"
            aria-label="Retirer un undercover"
            @click="setUndercoverCount(undercoverCount - 1)"
          >
            <Minus :size="16" />
          </IconButton>
          <span class="w-7 text-center font-display text-display-s text-red-4">{{ undercoverCount }}</span>
          <IconButton
            :size="36"
            aria-label="Ajouter un undercover"
            @click="setUndercoverCount(undercoverCount + 1)"
          >
            <Plus :size="16" />
          </IconButton>
        </div>
      </div>
    </Card>

    <Card class="flex flex-col gap-3">
      <div class="font-display text-body-s uppercase tracking-caps text-secondary">Noms de code</div>
      <div class="flex flex-col gap-2.5">
        <label v-for="(_, index) in names" :key="index" class="flex items-center gap-3">
          <span class="w-6 shrink-0 font-mono text-caption text-tertiary">{{ String(index + 1).padStart(2, '0') }}</span>
          <input
            v-model="names[index]"
            :class="inputClass"
            :placeholder="`Agent ${index + 1}`"
            type="text"
            maxlength="16"
            autocomplete="off"
          >
        </label>
      </div>
    </Card>

    <Card class="flex flex-col gap-3">
      <div class="flex items-start justify-between gap-4">
        <div>
          <div class="font-display text-body-s uppercase tracking-caps text-secondary">Mots de la mission</div>
          <div class="mt-0.5 font-mono text-caption text-tertiary">
            <template v-if="useCustomWords">Écrits par toi — aucune mission consommée.</template>
            <template v-else>Transmis par le QG à l'ouverture de la mission.</template>
          </div>
        </div>
        <Button
          v-if="diyUnlocked"
          size="s"
          :variant="useCustomWords ? 'secondary' : 'ghost'"
          class="shrink-0"
          @click="useCustomWords = !useCustomWords"
        >
          {{ useCustomWords ? 'Laisser le QG' : 'DIY' }}
        </Button>
      </div>

      <template v-if="useCustomWords">
        <label class="flex flex-col gap-1.5">
          <span class="font-mono text-caption uppercase tracking-caps text-tertiary">Mot des loyaux</span>
          <input v-model="customA" :class="inputClass" type="text" maxlength="32" placeholder="Café" autocomplete="off" >
        </label>
        <label class="flex flex-col gap-1.5">
          <span class="font-mono text-caption uppercase tracking-caps text-tertiary">Mot des infiltrés</span>
          <input v-model="customB" :class="inputClass" type="text" maxlength="32" placeholder="Thé" autocomplete="off" >
        </label>
        <p v-if="!customWordsReady" class="font-mono text-caption text-tertiary">
          Deux mots, proches mais différents.
        </p>
      </template>

      <template v-else>
        <p v-if="status === 'loading' || status === 'idle'" class="font-mono text-caption text-tertiary">
          Contact du QG… vérification de ton dossier.
        </p>

        <template v-else-if="status === 'error'">
          <p class="text-body-s text-secondary">
            Impossible de joindre le QG. Vérifie ta connexion, puis réessaie.
          </p>
          <Button size="s" variant="ghost" class="self-start" @click="emit('retry')">
            Réessayer
          </Button>
        </template>

        <template v-else-if="credits">
          <p v-if="outOfCredits" class="text-body-s text-secondary">
            Tu as épuisé tes missions du jour. Elles reviennent à minuit — ou tout de suite avec un pack.
          </p>
          <p v-else class="font-mono text-caption text-tertiary">
            Missions restantes aujourd'hui : {{ credits.remaining }}
            <template v-if="credits.wallet > 0">
              ({{ credits.dailyRemaining }} du jour + {{ credits.wallet }} en réserve)
            </template>
            <template v-else>/ {{ credits.dailyLimit }}</template>
          </p>
          <Button v-if="outOfCredits" size="s" variant="ghost" class="self-start" @click="emit('boutique')">
            Voir les packs
          </Button>
        </template>
      </template>
    </Card>

    <Toast v-if="error" tone="danger">{{ error }}</Toast>

    <template v-if="wordsError">
      <Toast tone="danger">{{ wordsError }}</Toast>
      <Button
        v-if="wordsErrorKind === 'locked' || wordsErrorKind === 'credits'"
        size="s"
        variant="ghost"
        class="self-start"
        @click="emit('boutique')"
      >
        Voir les packs
      </Button>
    </template>

    <Button
      size="l"
      class="w-full"
      :disabled="!canLaunch"
      @click="start()"
    >
      {{ drawing ? 'Contact du QG…' : 'Lancer la mission' }}
    </Button>
  </div>
</template>
