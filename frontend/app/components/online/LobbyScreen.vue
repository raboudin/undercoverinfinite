<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, Copy, LogOut, Minus, Plus } from '@lucide/vue'
import { MAX_PLAYERS, MIN_PLAYERS, maxUndercovers } from '../../composables/useGame'
import type { OnlinePlayer } from '../../composables/useRoomSocket'
import type { DifficultyCard, DifficultyId, ThemeCard, ThemeId } from '../../composables/useEntitlements'

const props = withDefaults(defineProps<{
  code: string
  inviteUrl: string
  players: OnlinePlayer[]
  viewerPlayerId: string
  isHost: boolean
  theme: ThemeId
  spicy: boolean
  difficulty: DifficultyId
  undercoverCount: number | null
  themes?: ThemeCard[]
  difficulties?: DifficultyCard[]
  error?: string | null
}>(), {
  themes: () => [],
  difficulties: () => [],
  error: null
})

const emit = defineEmits<{
  start: []
  configure: [{ theme?: ThemeId, spicy?: boolean, difficulty?: DifficultyId, undercoverCount?: number }]
  leave: []
}>()

const themesOpen = ref(false)
const copied = ref(false)

const currentTheme = computed(() => props.themes.find(item => item.id === props.theme) ?? null)
const undercoverCeiling = computed(() => maxUndercovers(props.players.length))
const effectiveUndercoverCount = computed(() => props.undercoverCount ?? 1)
const civilCount = computed(() => props.players.length - effectiveUndercoverCount.value)

const canStart = computed(
  () =>
    props.players.length >= MIN_PLAYERS
    && props.players.length <= MAX_PLAYERS
    && effectiveUndercoverCount.value >= 1
    && effectiveUndercoverCount.value <= undercoverCeiling.value
)

function setUndercoverCount(count: number) {
  if (count < 1 || count > undercoverCeiling.value) return
  emit('configure', { undercoverCount: count })
}

async function copyLink() {
  try {
    await navigator.clipboard.writeText(props.inviteUrl)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  }
  catch {
    // Presse-papiers indisponible (contexte non sécurisé, permission refusée) :
    // le lien reste affiché en clair, l'agent peut le copier à la main.
  }
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-col items-center gap-2 text-center">
      <span class="font-display text-body-s uppercase tracking-caps text-tertiary">Salle d'attente</span>
      <span class="font-display text-display-l uppercase tracking-caps text-primary">{{ code }}</span>
    </div>

    <Card class="flex items-center justify-between gap-3">
      <div class="min-w-0">
        <div class="font-display text-body-s uppercase tracking-caps text-secondary">Lien d'invitation</div>
        <div class="mt-0.5 truncate font-mono text-caption text-tertiary">{{ inviteUrl }}</div>
      </div>
      <Button size="s" variant="ghost" class="shrink-0" @click="copyLink()">
        <Check v-if="copied" :size="14" />
        <Copy v-else :size="14" />
        {{ copied ? 'Copié' : 'Copier' }}
      </Button>
    </Card>

    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <span class="font-display text-body-s uppercase tracking-caps text-tertiary">Agents présents</span>
        <span class="font-mono text-caption text-secondary">{{ players.length }} / {{ MAX_PLAYERS }}</span>
      </div>
      <div class="flex flex-col gap-2">
        <PlayerRow
          v-for="player in players"
          :key="player.id"
          :name="player.displayName + (player.id === viewerPlayerId ? ' (toi)' : '')"
          :status="player.connected ? 'active' : 'away'"
          :is-host="player.isHost"
        />
      </div>
      <p v-if="players.length < MIN_PLAYERS" class="text-center font-mono text-caption text-tertiary">
        Encore {{ MIN_PLAYERS - players.length }} agent{{ MIN_PLAYERS - players.length > 1 ? 's' : '' }} avant de pouvoir lancer.
      </p>
    </div>

    <template v-if="isHost">
      <Card class="flex flex-col gap-3">
        <div class="font-display text-body-s uppercase tracking-caps text-secondary">Dossier thématique</div>
        <ThemeButton :theme="currentTheme" :disabled="themes.length === 0" @open="themesOpen = true" />
      </Card>

      <Card class="flex items-center justify-between gap-4">
        <div>
          <div class="font-display text-body-s uppercase tracking-caps text-secondary">Contenu hot</div>
          <div class="mt-0.5 font-mono text-caption text-tertiary">Mots nettement plus osés. Réservé aux adultes.</div>
        </div>
        <SpicyToggle
          :model-value="spicy"
          @update:model-value="(next: boolean) => emit('configure', { spicy: next })"
        />
      </Card>

      <Card class="flex flex-col gap-3">
        <div class="font-display text-body-s uppercase tracking-caps text-secondary">Difficulté</div>
        <DifficultySlider
          :model-value="difficulty"
          :difficulties="difficulties"
          @update:model-value="(next: DifficultyId) => emit('configure', { difficulty: next })"
        />
      </Card>

      <Card class="flex items-center justify-between gap-4">
        <div>
          <div class="font-display text-body-s uppercase tracking-caps text-secondary">Undercovers infiltrés</div>
          <div class="mt-0.5 font-mono text-caption text-tertiary">
            {{ civilCount }} {{ civilCount > 1 ? 'loyaux' : 'loyal' }} · {{ effectiveUndercoverCount }} infiltré{{ effectiveUndercoverCount > 1 ? 's' : '' }}
          </div>
        </div>
        <div class="flex items-center gap-3">
          <IconButton :size="34" aria-label="Retirer un undercover" @click="setUndercoverCount(effectiveUndercoverCount - 1)">
            <Minus :size="15" />
          </IconButton>
          <span class="w-6 text-center font-display text-display-s text-red-4">{{ effectiveUndercoverCount }}</span>
          <IconButton :size="34" aria-label="Ajouter un undercover" @click="setUndercoverCount(effectiveUndercoverCount + 1)">
            <Plus :size="15" />
          </IconButton>
        </div>
      </Card>

      <Toast v-if="error" tone="danger">{{ error }}</Toast>

      <Button size="l" class="w-full" :disabled="!canStart" @click="emit('start')">
        Lancer la mission
      </Button>
    </template>

    <template v-else>
      <Toast v-if="error" tone="danger">{{ error }}</Toast>
      <p class="text-center text-body-s text-secondary">
        En attente que l'hôte lance la mission.
      </p>
    </template>

    <Button size="s" variant="ghost" class="w-full" @click="emit('leave')">
      <LogOut :size="14" />
      Quitter la salle
    </Button>

    <ThemeCarousel
      :model-value="theme"
      :open="themesOpen"
      :themes="themes"
      @close="themesOpen = false"
      @update:model-value="(next: ThemeId) => emit('configure', { theme: next })"
    />
  </div>
</template>
