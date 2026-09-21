<script setup lang="ts">
import { computed, nextTick, ref, useTemplateRef, watch } from 'vue'
import { ChevronLeft, Minus, Plus } from '@lucide/vue'
import { MAX_PLAYERS, MIN_PLAYERS, maxUndercovers, type GameConfig } from '../../composables/useGame'
import type {
  DifficultyCard,
  DifficultyId,
  EntitlementsStatus,
} from '../../composables/useEntitlements'
import type { TableSeat } from './GameTable.vue'
import logoFull from '../../assets/images/logo-full.png'

export interface SetupSubmission {
  config: GameConfig
  spicy: boolean
  difficulty: DifficultyId
}

const props = withDefaults(defineProps<{
  error?: string | null
  difficulties?: DifficultyCard[]
  status?: EntitlementsStatus
  /** Un tirage est en cours côté serveur. */
  drawing?: boolean
  wordsError?: string | null
  /** Pré-remplissage pour un replay : démarre directement à l'étape table. */
  initialNames?: string[]
  initialUndercoverCount?: number
  initialSpicy?: boolean
  initialDifficulty?: DifficultyId
}>(), {
  error: null,
  difficulties: () => [],
  status: 'ready',
  drawing: false,
  wordsError: null,
  initialNames: undefined,
  initialUndercoverCount: undefined,
  initialSpicy: undefined,
  initialDifficulty: undefined,
})

const emit = defineEmits<{
  start: [SetupSubmission]
  retry: []
}>()

const step = ref<'menu' | 'table'>(props.initialNames?.length ? 'table' : 'menu')

const names = ref<string[]>(props.initialNames?.length ? [...props.initialNames] : ['', '', '', ''])
/** Siège en cours d'édition : la table entière n'a qu'un champ de saisie. */
const activeSeat = ref(0)
const undercoverCount = ref(props.initialUndercoverCount ?? 1)
const spicy = ref(props.initialSpicy ?? false)
const difficulty = ref<DifficultyId>(props.initialDifficulty ?? 'normal')

const seatInput = useTemplateRef<HTMLInputElement>('seatInput')

const undercoverCeiling = computed(() => maxUndercovers(names.value.length))
const civilCount = computed(() => names.value.length - undercoverCount.value)


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

const canLaunch = computed(() => props.status === 'ready' && !props.drawing)

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

function start() {
  emit('start', {
    config: {
      names: names.value,
      undercoverCount: undercoverCount.value
    },
    spicy: spicy.value,
    difficulty: difficulty.value
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

    <div class="flex flex-col gap-3">
      <Button size="l" class="w-full" @click="step = 'table'">
        Jouer en local
      </Button>
      <NuxtLink to="/salle" class="w-full">
        <Button size="l" variant="secondary" class="w-full">
          Jouer en ligne — partie privée
        </Button>
      </NuxtLink>
    </div>
  </div>

  <div v-else class="flex flex-col gap-5">
    <div class="flex items-center gap-3">
      <IconButton :size="36" aria-label="Revenir au menu" @click="step = 'menu'">
        <ChevronLeft :size="16" />
      </IconButton>
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

    <Card class="flex items-center justify-between gap-4">
      <div>
        <div class="font-display text-body-s uppercase tracking-caps text-secondary">Contenu hot</div>
        <div class="mt-0.5 font-mono text-caption text-tertiary">Mots nettement plus osés. Réservé aux adultes.</div>
      </div>
      <SpicyToggle v-model="spicy" />
    </Card>

    <Card class="flex flex-col gap-3">
      <div class="font-display text-body-s uppercase tracking-caps text-secondary">Difficulté</div>
      <DifficultySlider v-model="difficulty" :difficulties="difficulties" />
    </Card>

    <Toast v-if="spicy" tone="danger">
      Contenu hot : mots réservés à un public adulte.
    </Toast>

    <Card v-if="status === 'loading' || status === 'idle' || status === 'error'" class="flex flex-col gap-3">
      <div>
        <div class="font-display text-body-s uppercase tracking-caps text-secondary">Mots de la mission</div>
        <div class="mt-0.5 font-mono text-caption text-tertiary">
          Transmis par le QG à l'ouverture de la mission.
        </div>
      </div>

      <p v-if="status === 'loading' || status === 'idle'" class="font-mono text-caption text-tertiary">
        Contact du QG… vérification du dossier.
      </p>

      <template v-else>
        <p class="text-body-s text-secondary">
          Impossible de joindre le QG. Vérifie ta connexion, puis réessaie.
        </p>
        <Button size="s" variant="ghost" class="self-start" @click="emit('retry')">
          Réessayer
        </Button>
      </template>
    </Card>

    <Toast v-if="error" tone="danger">{{ error }}</Toast>
    <Toast v-if="wordsError" tone="danger">{{ wordsError }}</Toast>

    <Button size="l" class="w-full" :disabled="!canLaunch" @click="start()">
      {{ drawing ? 'Contact du QG…' : 'Lancer la mission' }}
    </Button>
  </div>
</template>
