<script setup lang="ts">
withDefaults(defineProps<{
  glow?: 'danger' | 'recon' | null
}>(), {
  glow: null
})

const glowClasses = {
  danger: 'shadow-glow-danger',
  recon: 'shadow-glow-recon'
}
</script>

<template>
  <div
    :class="[
      'rounded-md border border-subtle bg-surface p-5',
      glow ? glowClasses[glow] : 'shadow-card'
    ]"
  >
    <slot />
  </div>
</template>
