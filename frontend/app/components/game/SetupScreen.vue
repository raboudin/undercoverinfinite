<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Minus, Plus } from '@lucide/vue'
import { MAX_PLAYERS, MIN_PLAYERS, maxUndercovers, type GameConfig } from '../../composables/useGame'
import logoFull from '../../assets/images/logo-full.png'

defineProps<{ error?: string | null }>()

const emit = defineEmits<{ start: [GameConfig] }>()

const names = ref<string[]>(['', '', '', ''])
const undercoverCount = ref(1)

const undercoverCeiling = computed(() => maxUndercovers(names.value.length))
const civilCount = computed(() => names.value.length - undercoverCount.value)

// Réduire l'effectif peut rendre le nombre d'undercovers illégal : on le
// ramène sous le plafond plutôt que de laisser passer une config invalide.
watch(undercoverCeiling, ceiling => {
  if (undercoverCount.value > ceiling) undercoverCount.value = ceiling
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

    <Toast v-if="error" tone="danger">{{ error }}</Toast>

    <Button
      size="l"
      class="w-full"
      @click="emit('start', { names, undercoverCount })"
    >
      Lancer la mission
    </Button>
  </div>
</template>
