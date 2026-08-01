<script setup lang="ts">
const props = withDefaults(defineProps<{
  active?: boolean
  size?: number
}>(), {
  active: false,
  size: 40
})
</script>

<template>
  <button
    :style="{ width: `${props.size}px`, height: `${props.size}px` }"
    :class="[
      'flex items-center justify-center rounded-sm border transition-colors duration-150 ease-out cursor-pointer',
      active
        ? 'bg-ink-4 border-strong text-blue-3'
        : 'bg-transparent border-subtle text-secondary'
    ]"
  >
    <slot />
  </button>
</template>
