<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ChevronLeft, ChevronRight, Lock, X } from '@lucide/vue'
import type { ThemeCard, ThemeId } from '../../composables/useEntitlements'
import { themeHero } from '../../utils/gameArt'

/**
 * Vitrine des dossiers thématiques : un thème par écran, on passe au suivant au
 * doigt ou à la flèche.
 *
 * Présentationnel comme les autres écrans de jeu : un dossier verrouillé
 * remonte `locked`, il ne navigue pas lui-même vers la boutique — sinon chaque
 * test devrait installer un routeur.
 */
const props = withDefaults(defineProps<{
  open: boolean
  themes?: ThemeCard[]
}>(), {
  themes: () => []
})

const selected = defineModel<ThemeId>({ default: 'general' })

const emit = defineEmits<{ close: []; locked: [ThemeId] }>()

/** Distance à parcourir avant qu'un glissement compte comme un changement de page. */
const SWIPE_THRESHOLD = 56
/** Part de la largeur, à gauche comme à droite, où les flèches se révèlent. */
const EDGE_RATIO = 0.22

const index = ref(0)
const dragX = ref(0)
const dragging = ref(false)
const nearEdge = ref<'left' | 'right' | null>(null)

const current = computed<ThemeCard | null>(() => props.themes[index.value] ?? null)
const canPrev = computed(() => index.value > 0)
const canNext = computed(() => index.value < props.themes.length - 1)

// L'ouverture se cale sur le dossier déjà choisi : ouvrir la vitrine ne doit
// pas donner l'impression d'avoir perdu sa sélection.
watch(() => props.open, (open) => {
  if (!open) return
  const found = props.themes.findIndex(theme => theme.id === selected.value)
  index.value = found >= 0 ? found : 0
  dragX.value = 0
  nearEdge.value = null
}, { immediate: true })

function go(step: number) {
  const next = index.value + step
  if (next < 0 || next >= props.themes.length) return
  index.value = next
}

function choose() {
  const theme = current.value
  if (!theme) return
  if (!theme.unlocked) {
    emit('locked', theme.id)
    return
  }
  selected.value = theme.id
  emit('close')
}

/* ---------------------------------------------------------------- gestes -- */

let startX = 0

function onTouchStart(event: TouchEvent) {
  const touch = event.touches[0]
  if (!touch) return
  startX = touch.clientX
  dragging.value = true
  dragX.value = 0
}

function onTouchMove(event: TouchEvent) {
  const touch = event.touches[0]
  if (!dragging.value || !touch) return
  dragX.value = touch.clientX - startX
}

function onTouchEnd() {
  if (!dragging.value) return
  dragging.value = false
  const travelled = dragX.value
  dragX.value = 0
  if (travelled <= -SWIPE_THRESHOLD) go(1)
  else if (travelled >= SWIPE_THRESHOLD) go(-1)
}

/**
 * Les flèches ne s'imposent qu'à l'approche d'un bord : au centre elles
 * masqueraient l'illustration, qui est tout l'intérêt de la fiche.
 */
function onPointerMove(event: MouseEvent) {
  const target = event.currentTarget as HTMLElement | null
  if (!target) return
  const { left, width } = target.getBoundingClientRect()
  if (width <= 0) return
  const ratio = (event.clientX - left) / width
  nearEdge.value = ratio <= EDGE_RATIO ? 'left' : ratio >= 1 - EDGE_RATIO ? 'right' : null
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'ArrowLeft') go(-1)
  else if (event.key === 'ArrowRight') go(1)
  else if (event.key === 'Escape') emit('close')
  else return
  event.preventDefault()
}

/**
 * Le clavier est écouté au niveau du document : la feuille est téléportée dans
 * `body`, elle n'a pas le focus par défaut. Le garde sur `document` n'est pas
 * décoratif — le watcher est immédiat, il tourne donc aussi au rendu serveur,
 * où il n'y a pas de document.
 */
function bindKeys(active: boolean) {
  if (typeof document === 'undefined') return
  if (active) document.addEventListener('keydown', onKeydown)
  else document.removeEventListener('keydown', onKeydown)
}

watch(() => props.open, bindKeys, { immediate: true })

onBeforeUnmount(() => bindKeys(false))

function arrowClass(side: 'left' | 'right', enabled: boolean) {
  if (!enabled) return 'pointer-events-none opacity-0'
  return nearEdge.value === side ? 'opacity-100' : 'opacity-40'
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="dossier-texture fixed inset-0 z-[110] flex flex-col bg-app"
      role="dialog"
      aria-modal="true"
      aria-label="Dossiers thématiques"
    >
      <header class="flex shrink-0 items-center justify-between gap-3 border-b border-subtle px-5 py-3">
        <div>
          <div class="font-display text-body-s uppercase tracking-caps text-secondary">Dossier thématique</div>
          <div class="font-mono text-caption text-tertiary">
            {{ themes.length > 0 ? index + 1 : 0 }} / {{ themes.length }}
          </div>
        </div>
        <IconButton :size="36" aria-label="Fermer les dossiers" @click="emit('close')">
          <X :size="16" />
        </IconButton>
      </header>

      <div
        class="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-5 py-4"
        @touchstart.passive="onTouchStart"
        @touchmove.passive="onTouchMove"
        @touchend="onTouchEnd"
        @touchcancel="onTouchEnd"
        @mousemove="onPointerMove"
        @mouseleave="nearEdge = null"
      >
        <div
          v-if="current"
          class="flex h-full w-full max-w-sm flex-col gap-4"
          :style="{
            transform: `translateX(${dragX}px)`,
            transition: dragging ? 'none' : 'transform .25s ease-out'
          }"
        >
          <div class="relative min-h-0 flex-1 overflow-hidden rounded-md border border-subtle shadow-card">
            <ArtSlot
              :src="themeHero(current.id)"
              :alt="current.label"
              :monogram="current.label"
              class="h-full w-full"
            />
            <div class="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink-0 via-ink-0/80 to-transparent p-4 pt-16">
              <div class="flex items-center gap-2">
                <Lock v-if="!current.unlocked" :size="14" class="shrink-0 text-amber-4" />
                <h2 class="font-display text-display-s uppercase tracking-caps text-primary">
                  {{ current.label }}
                </h2>
              </div>
              <p class="mt-1 text-body-s text-secondary">{{ current.tagline }}</p>
            </div>
          </div>

          <RoleTag :tone="current.unlocked ? 'ally' : 'classified'" class="self-start">
            {{ current.unlocked ? 'Dossier accessible' : 'Dossier scellé' }}
          </RoleTag>
        </div>

        <p v-else class="text-body-s text-tertiary">Aucun dossier disponible.</p>

        <button
          type="button"
          aria-label="Dossier précédent"
          :disabled="!canPrev"
          :class="[
            'absolute left-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-pill',
            'border border-subtle bg-surface/85 text-secondary backdrop-blur-sm transition-opacity duration-200',
            arrowClass('left', canPrev)
          ]"
          @click="go(-1)"
        >
          <ChevronLeft :size="20" />
        </button>
        <button
          type="button"
          aria-label="Dossier suivant"
          :disabled="!canNext"
          :class="[
            'absolute right-2 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-pill',
            'border border-subtle bg-surface/85 text-secondary backdrop-blur-sm transition-opacity duration-200',
            arrowClass('right', canNext)
          ]"
          @click="go(1)"
        >
          <ChevronRight :size="20" />
        </button>
      </div>

      <footer class="flex shrink-0 flex-col gap-3 border-t border-subtle px-5 pb-6 pt-4">
        <div class="flex items-center justify-center gap-1.5">
          <span
            v-for="(theme, dot) in themes"
            :key="theme.id"
            class="h-1 rounded-pill transition-all duration-200"
            :class="dot === index ? 'w-5 bg-blue-3' : 'w-1 bg-ink-5'"
          />
        </div>

        <Button
          v-if="current && !current.unlocked"
          size="l"
          variant="secondary"
          class="w-full"
          @click="choose()"
        >
          Débloquer dans la boutique
        </Button>
        <Button
          v-else
          size="l"
          class="w-full"
          :disabled="!current"
          @click="choose()"
        >
          {{ current && current.id === selected ? 'Garder ce dossier' : 'Choisir ce dossier' }}
        </Button>
      </footer>
    </div>
  </Teleport>
</template>
