<script setup lang="ts">
withDefaults(defineProps<{
  tone?: 'neutral' | 'ally' | 'danger' | 'warning' | 'classified'
}>(), {
  tone: 'neutral'
})

const toneClasses = {
  neutral: 'bg-ink-4 text-fog-2 border border-default',
  ally: 'bg-transparent text-blue-3 border border-blue-4',
  danger: 'bg-danger text-paper-0 border border-red-4',
  warning: 'bg-transparent text-amber-4 border border-amber-5',
  classified: 'bg-transparent text-olive-4 border border-dashed border-olive-5'
}
</script>

<template>
  <span
    :class="[
      'inline-flex items-center px-3 py-1 rounded-pill font-display text-caption uppercase tracking-caps font-medium',
      toneClasses[tone]
    ]"
  >
    <slot />
  </span>
</template>
