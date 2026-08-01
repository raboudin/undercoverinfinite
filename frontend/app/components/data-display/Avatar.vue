<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  initial?: string
  size?: number
  status?: 'online' | 'away' | 'eliminated' | null
}>(), {
  initial: '?',
  size: 44,
  status: null
})

const statusClasses = {
  online: 'bg-success',
  away: 'bg-amber-5',
  eliminated: 'bg-danger'
}

const dotSize = computed(() => Math.round(props.size * 0.28))
</script>

<template>
  <div class="relative" :style="{ width: `${size}px`, height: `${size}px` }">
    <div
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
