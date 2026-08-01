<script setup lang="ts">
withDefaults(defineProps<{
  pct: number
  label?: string
  danger?: boolean
}>(), {
  danger: false
})
</script>

<template>
  <div>
    <div v-if="label" class="mb-1.5 flex justify-between font-mono text-caption text-tertiary">
      <span>{{ label }}</span>
      <span :class="danger ? 'text-red-4' : 'text-secondary'">{{ Math.round(pct * 100) }}%</span>
    </div>
    <div class="h-1.5 overflow-hidden rounded-pill bg-ink-4">
      <div
        class="h-full rounded-pill transition-[width] duration-200 ease-linear"
        :class="danger ? 'bg-danger' : 'bg-accent-secondary'"
        :style="{ width: `${pct * 100}%` }"
      />
    </div>
  </div>
</template>
