<script setup lang="ts">
import { computed } from 'vue'
import { seatLayout } from '../../utils/tableLayout'

export type SeatState = 'empty' | 'idle' | 'active' | 'eliminated'

/** Un siège de la table. Le composant ne connaît rien du moteur de jeu. */
export interface TableSeat {
  id: string
  name: string
  state?: SeatState
  /** Carte retournée : sa face visible montre `word`. */
  faceUp?: boolean
  word?: string | null
  disabled?: boolean
}

const props = withDefaults(defineProps<{
  seats: TableSeat[]
  /** Les sièges deviennent des boutons. */
  selectable?: boolean
  selectedId?: string | null
  /** Étiquette d'accessibilité du geste proposé sur un siège. */
  actionLabel?: string
}>(), {
  selectable: false,
  selectedId: null,
  actionLabel: 'Choisir'
})

const emit = defineEmits<{ select: [string] }>()

/** Géométrie du plateau : voir `utils/tableLayout`, qui en porte les règles. */
const layout = computed(() => seatLayout(props.seats.length))

const placed = computed(() =>
  props.seats.map((seat, index) => {
    const position = layout.value.positions[index]!
    return {
      seat,
      index,
      style: {
        left: `${position.left}%`,
        top: `${position.top}%`,
        width: `${layout.value.seat}%`
      }
    }
  })
)

/** Le mot doit tenir dans une carte qui rétrécit avec l'effectif. */
const wordClass = computed(() =>
  layout.value.seat >= 26 ? 'text-body' : layout.value.seat >= 18 ? 'text-body-s' : 'text-caption'
)

/**
 * Le nom aussi. C'est surtout l'interlettrage (`tracking-caps`) qui le fait
 * déborder : sur une table de douze, il coupe « Marion » à deux lettres et
 * trois points de suspension.
 */
const nameClass = computed(() =>
  layout.value.seat >= 24
    ? 'text-caption tracking-caps'
    : layout.value.seat >= 18
      ? 'text-[10px] tracking-normal'
      : 'text-[9px] tracking-normal'
)

const frameClasses: Record<SeatState, string> = {
  empty: 'border-dashed border-subtle',
  idle: 'border-subtle',
  active: 'border-blue-4 shadow-glow-recon',
  eliminated: 'border-red-9'
}

/**
 * L'atténuation d'un siège grillé se pose sur la scène, jamais sur la carte :
 * une `opacity` inférieure à 1 sur un élément `transform-style: preserve-3d`
 * aplatit son contexte 3D, et `backface-visibility` cesse d'opérer — la carte
 * retournée montre alors sa face cachée à l'envers, en miroir.
 */
function stateOf(seat: TableSeat): SeatState {
  return seat.state ?? 'idle'
}

function pick(seat: TableSeat) {
  if (!props.selectable || seat.disabled) return
  emit('select', seat.id)
}
</script>

<template>
  <div class="relative aspect-square w-full select-none">
    <!-- Le plateau. Purement décoratif : les sièges vivent au-dessus. -->
    <div class="table-felt absolute inset-[10%] rounded-[50%] border border-subtle shadow-raised" />
    <div class="absolute inset-[16%] rounded-[50%] border border-ink-4/70" />

    <!-- Le centre sert de tableau de bord : manche en cours, consigne, mot révélé. -->
    <div class="absolute inset-x-[26%] top-1/2 -translate-y-1/2 text-center">
      <slot />
    </div>

    <div
      v-for="{ seat, index, style } in placed"
      :key="seat.id"
      class="flip-scene absolute -translate-x-1/2 -translate-y-1/2"
      :class="stateOf(seat) === 'eliminated' ? 'opacity-60' : ''"
      :style="style"
    >
      <component
        :is="selectable ? 'button' : 'div'"
        :type="selectable ? 'button' : undefined"
        :disabled="selectable ? seat.disabled : undefined"
        :aria-pressed="selectable ? String(selectedId === seat.id) : undefined"
        :aria-label="selectable ? `${actionLabel} ${seat.name || `siège ${index + 1}`}` : undefined"
        :class="[
          'flip-card block w-full rounded-sm border bg-surface text-left',
          layout.tall ? 'aspect-[4/5]' : 'aspect-square',
          frameClasses[stateOf(seat)],
          selectedId === seat.id ? 'ring-1 ring-focus-ring' : '',
          selectable && !seat.disabled ? 'cursor-pointer' : 'cursor-default',
          seat.faceUp ? 'flip-card--up' : ''
        ]"
        @click="pick(seat)"
      >
        <!-- Face cachée : ce que voit la table. -->
        <span class="flip-face dossier-texture flex flex-col items-center justify-between rounded-sm px-1 py-1.5">
          <span class="font-mono text-caption leading-none text-tertiary">{{ String(index + 1).padStart(2, '0') }}</span>
          <span
            class="font-display text-display-s leading-none"
            :class="stateOf(seat) === 'eliminated' ? 'text-red-9' : 'text-ink-5'"
          >∞</span>
          <span
            class="w-full truncate text-center font-display uppercase"
            :class="[
              nameClass,
              stateOf(seat) === 'empty' ? 'text-tertiary' : 'text-secondary',
              stateOf(seat) === 'eliminated' ? 'line-through' : ''
            ]"
          >{{ seat.name || '—' }}</span>
        </span>

        <!-- Face révélée : le mot, jamais le rôle. -->
        <span class="flip-face flip-face--back flex flex-col items-center justify-between rounded-sm bg-ink-3 px-1 py-1.5">
          <span class="font-mono text-caption leading-none text-tertiary">{{ String(index + 1).padStart(2, '0') }}</span>
          <!--
            `v-if` et pas seulement la rotation CSS : `backface-visibility`
            cache la face au regard, pas au DOM. Sans ça le mot serait lisible
            dans la page — et lu à voix haute par un lecteur d'écran — alors que
            la carte est encore face cachée.
          -->
          <span
            v-if="seat.faceUp"
            class="line-clamp-3 px-0.5 text-center font-display uppercase leading-tight tracking-caps text-primary"
            :class="wordClass"
          >{{ seat.word }}</span>
          <!-- Cale : la face garde ses trois lignes, donc sa répartition. -->
          <span v-else />
          <span
            class="w-full truncate text-center font-display uppercase text-tertiary"
            :class="[nameClass, stateOf(seat) === 'eliminated' ? 'line-through' : '']"
          >{{ seat.name || '—' }}</span>
        </span>
      </component>
    </div>
  </div>
</template>
