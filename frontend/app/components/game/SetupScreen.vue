<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { ChevronLeft, Minus, Plus } from '@lucide/vue'
import {
  DEFAULT_TIMER_SECONDS,
  MAX_PLAYERS,
  MAX_TIMER_SECONDS,
  MIN_PLAYERS,
  MIN_TIMER_SECONDS,
  maxUndercovers,
  type GameConfig
} from '../../composables/useGame'
import type {
  Credits,
  EntitlementsStatus,
  ModeCard,
  ModeId,
  ThemeCard,
  ThemeId
} from '../../composables/useEntitlements'
import type { WordsErrorKind } from '../../composables/useWords'
import type { TableSeat } from './GameTable.vue'
import logoFull from '../../assets/images/logo-full.png'

export interface SetupSubmission {
  config: GameConfig
  theme: ThemeId
}

const props = withDefaults(defineProps<{
  error?: string | null
  /** Modes proposés, hors DIY qui n'est pas un mode mais une source de mots. */
  modes?: ModeCard[]
  themes?: ThemeCard[]
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

/**
 * Deux temps. Le menu ne montre que les modes et le dossier thématique — c'est
 * la seule décision à prendre avant de sortir le téléphone du sac. La table
 * vient ensuite : elle réunit tout ce qui dépend des joueurs présents.
 */
const step = ref<'menu' | 'table'>('menu')

const names = ref<string[]>(['', '', '', ''])
/** Siège en cours d'édition : la table entière n'a qu'un champ de saisie. */
const activeSeat = ref(0)
const undercoverCount = ref(1)
const mode = ref<ModeId>('classique')
const theme = ref<ThemeId>('general')
const timerSeconds = ref(DEFAULT_TIMER_SECONDS)
const themesOpen = ref(false)

const seatInput = useTemplateRef<HTMLInputElement>('seatInput')

const undercoverCeiling = computed(() => maxUndercovers(names.value.length))
const civilCount = computed(() => names.value.length - undercoverCount.value)

const currentMode = computed(() => props.modes.find(item => item.id === mode.value) ?? null)
const isTimed = computed(() => mode.value === 'chrono')
const isSpicy = computed(() => currentMode.value?.spicy === true)

/**
 * Le mode hot impose son propre registre de mots : lui proposer un dossier
 * thématique laisserait croire à un réglage qui n'a aucune prise.
 */
const themePicker = computed(() => !isSpicy.value)
const currentTheme = computed(() => props.themes.find(item => item.id === theme.value) ?? null)
const submittedTheme = computed<ThemeId>(() => (isSpicy.value ? 'general' : theme.value))

const seats = computed<TableSeat[]>(() =>
  names.value.map((name, index) => ({
    id: `seat-${index}`,
    name: name.trim(),
    state: name.trim().length > 0 ? 'idle' : 'empty'
  }))
)

// Réduire l'effectif peut rendre le nombre d'undercovers illégal : on le
// ramène sous le plafond plutôt que de laisser passer une config invalide.
watch(undercoverCeiling, (ceiling) => {
  if (undercoverCount.value > ceiling) undercoverCount.value = ceiling
})

// Retirer des sièges peut laisser l'édition pointer dans le vide.
watch(() => names.value.length, (count) => {
  if (activeSeat.value >= count) activeSeat.value = count - 1
})

const outOfCredits = computed(
  () => props.status === 'ready' && (props.credits?.remaining ?? 0) === 0
)

const canLaunch = computed(
  () => props.status === 'ready' && !props.drawing && (props.credits?.remaining ?? 0) > 0
)

function setPlayerCount(count: number) {
  if (count < MIN_PLAYERS || count > MAX_PLAYERS) return
  if (count > names.value.length) {
    names.value = [...names.value, ...Array.from({ length: count - names.value.length }, () => '')]
    // Ajouter un siège, c'est vouloir y écrire un nom tout de suite.
    activeSeat.value = names.value.length - 1
    focusSeatInput()
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

/**
 * Le champ de saisie reprend la main après chaque changement de siège : sans
 * ça, il faudrait retoucher le champ à chaque nom, et le clavier du téléphone
 * se refermerait entre deux agents.
 */
function focusSeatInput() {
  void nextTick(() => seatInput.value?.focus())
}

function selectSeat(id: string) {
  const index = seats.value.findIndex(seat => seat.id === id)
  if (index < 0) return
  activeSeat.value = index
  focusSeatInput()
}

/** Enchaîner les noms sans lever les yeux : le tour de table se fait au clavier. */
function nextSeat() {
  activeSeat.value = (activeSeat.value + 1) % names.value.length
  focusSeatInput()
}

/** Un dossier scellé referme la vitrine et bascule sur la boutique. */
function onThemeLocked() {
  themesOpen.value = false
  emit('boutique')
}

function start() {
  emit('start', {
    config: {
      names: names.value,
      undercoverCount: undercoverCount.value,
      mode: mode.value,
      timerSeconds: timerSeconds.value
    },
    theme: submittedTheme.value
  })
}

const inputClass
  = 'w-full rounded-sm border border-subtle bg-surface-inset px-3 py-2.5 text-[16px] text-primary '
    + 'placeholder:text-tertiary focus:border-strong focus:outline-none focus:ring-1 focus:ring-focus-ring'
</script>

<template>
  <div v-if="step === 'menu'" class="flex flex-col gap-6">
    <div class="flex flex-col items-center gap-3">
      <img :src="logoFull" alt="Undercover Infinite" class="w-64 max-w-full object-contain" >
      <p class="text-center text-body-s text-tertiary">
        Un agent double se cache parmi vous.
      </p>
    </div>

    <ModeSelector v-model="mode" :modes="modes" @locked="emit('boutique')" />

    <Toast v-if="isSpicy" tone="danger">
      Mode hot : mots réservés à un public adulte.
    </Toast>

    <ThemeButton
      v-if="themePicker"
      :theme="currentTheme"
      :disabled="themes.length === 0"
      @open="themesOpen = true"
    />

    <p v-if="status === 'ready' && credits" class="text-center font-mono text-caption text-tertiary">
      Missions restantes aujourd'hui : {{ credits.remaining }}
    </p>

    <Button size="l" class="w-full" @click="step = 'table'">
      Dresser la table
    </Button>

    <ThemeCarousel
      v-model="theme"
      :open="themesOpen"
      :themes="themes"
      @close="themesOpen = false"
      @locked="onThemeLocked"
    />
  </div>

  <div v-else class="flex flex-col gap-5">
    <div class="flex items-center gap-3">
      <IconButton :size="36" aria-label="Revenir au choix du mode" @click="step = 'menu'">
        <ChevronLeft :size="16" />
      </IconButton>
      <div class="min-w-0">
        <div class="truncate font-display text-body-s uppercase tracking-caps text-primary">
          {{ currentMode?.label ?? 'Classique' }}
        </div>
        <div class="truncate font-mono text-caption text-tertiary">
          <template v-if="themePicker">{{ currentTheme?.label ?? 'Tous horizons' }}</template>
          <template v-else>Registre osé</template>
        </div>
      </div>
    </div>

    <GameTable
      :seats="seats"
      selectable
      :selected-id="seats[activeSeat]?.id ?? null"
      action-label="Renommer"
      @select="selectSeat"
    >
      <div class="font-display text-display-s uppercase tracking-caps text-primary">
        {{ names.length }}
      </div>
      <div class="font-mono text-caption uppercase tracking-caps text-tertiary">
        agents attablés
      </div>
      <div class="mt-1 font-mono text-caption text-red-4">
        {{ undercoverCount }} infiltré{{ undercoverCount > 1 ? 's' : '' }}
      </div>
    </GameTable>

    <Card class="flex flex-col gap-4">
      <div class="flex items-center justify-between gap-4">
        <div>
          <div class="font-display text-body-s uppercase tracking-caps text-secondary">Noms de code</div>
          <div class="mt-0.5 font-mono text-caption text-tertiary">
            Touche un siège, écris le nom · de {{ MIN_PLAYERS }} à {{ MAX_PLAYERS }} agents.
          </div>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <IconButton :size="34" aria-label="Retirer un agent" @click="setPlayerCount(names.length - 1)">
            <Minus :size="15" />
          </IconButton>
          <IconButton :size="34" aria-label="Ajouter un agent" @click="setPlayerCount(names.length + 1)">
            <Plus :size="15" />
          </IconButton>
        </div>
      </div>

      <div class="flex items-center gap-2.5">
        <span class="w-7 shrink-0 text-center font-mono text-caption text-tertiary">
          {{ String(activeSeat + 1).padStart(2, '0') }}
        </span>
        <input
          ref="seatInput"
          v-model="names[activeSeat]"
          :class="inputClass"
          :placeholder="`Agent ${activeSeat + 1}`"
          type="text"
          maxlength="16"
          autocomplete="off"
          @keydown.enter.prevent="nextSeat()"
        >
        <Button size="s" variant="ghost" class="shrink-0" @click="nextSeat()">Siège suivant</Button>
      </div>
    </Card>

    <Card class="flex items-center justify-between gap-4">
      <div>
        <div class="font-display text-body-s uppercase tracking-caps text-secondary">Undercovers infiltrés</div>
        <div class="mt-0.5 font-mono text-caption text-tertiary">
          {{ civilCount }} {{ civilCount > 1 ? 'loyaux' : 'loyal' }} · {{ undercoverCount }} infiltré{{ undercoverCount > 1 ? 's' : '' }}
        </div>
      </div>
      <div class="flex items-center gap-3">
        <IconButton :size="34" aria-label="Retirer un undercover" @click="setUndercoverCount(undercoverCount - 1)">
          <Minus :size="15" />
        </IconButton>
        <span class="w-6 text-center font-display text-display-s text-red-4">{{ undercoverCount }}</span>
        <IconButton :size="34" aria-label="Ajouter un undercover" @click="setUndercoverCount(undercoverCount + 1)">
          <Plus :size="15" />
        </IconButton>
      </div>
    </Card>

    <Card v-if="isTimed" class="flex items-center justify-between gap-4">
      <div>
        <div class="font-display text-body-s uppercase tracking-caps text-secondary">Temps de parole</div>
        <div class="mt-0.5 font-mono text-caption text-tertiary">par agent et par manche</div>
      </div>
      <div class="flex items-center gap-3">
        <IconButton :size="34" aria-label="Réduire le temps de parole" @click="setTimer(timerSeconds - 5)">
          <Minus :size="15" />
        </IconButton>
        <span class="w-12 text-center font-display text-display-s text-primary">{{ timerSeconds }}s</span>
        <IconButton :size="34" aria-label="Augmenter le temps de parole" @click="setTimer(timerSeconds + 5)">
          <Plus :size="15" />
        </IconButton>
      </div>
    </Card>

    <Card class="flex flex-col gap-3">
      <div>
        <div class="font-display text-body-s uppercase tracking-caps text-secondary">Mots de la mission</div>
        <div class="mt-0.5 font-mono text-caption text-tertiary">
          Transmis par le QG à l'ouverture de la mission.
        </div>
      </div>

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

    <Button size="l" class="w-full" :disabled="!canLaunch" @click="start()">
      {{ drawing ? 'Contact du QG…' : 'Lancer la mission' }}
    </Button>
  </div>
</template>
