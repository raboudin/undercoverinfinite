<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  initial?: string
  /** Photo de profil ; l'initiale reste le repli quand elle manque. */
  src?: string | null
  size?: number
  status?: 'online' | 'away' | 'eliminated' | null
}>(), {
  initial: '?',
  src: null,
  size: 44,
  status: null
})

const statusClasses = {
  online: 'bg-success',
  away: 'bg-amber-5',
  eliminated: 'bg-danger'
}

const dotSize = computed(() => Math.round(props.size * 0.28))

// Une URL de photo qui répond 404 (photo effacée entre-temps, cache trop
// zélé) ne doit pas laisser un carré vide : on repasse à l'initiale.
const broken = ref(false)
watch(() => props.src, () => {
  broken.value = false
})

const showImage = computed(() => !!props.src && !broken.value)
</script>

<template>
  <div class="relative" :style="{ width: `${size}px`, height: `${size}px` }">
    <img
      v-if="showImage"
      :src="src ?? undefined"
      alt=""
      class="h-full w-full rounded-full border border-default bg-ink-4 object-cover"
      @error="broken = true"
    >
    <div
      v-else
      class="flex h-full w-full items-center justify-center rounded-full border border-default bg-ink-4 font-display uppercase text-fog-2"
      :style="{ fontSize: `${size * 0.4}px` }"
    >
      {{ initial }}
    </div>
    <span
      v-if="status"
      class="absolute bottom-0 right-0 rounded-full border-2 border-surface"
      :class="statusClasses[status]"
      :style="{ width: `${dotSize}px`, height: `${dotSize}px` }"
    />
  </div>
</template>
