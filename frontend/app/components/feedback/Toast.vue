<script setup lang="ts">
withDefaults(defineProps<{
  tone?: 'info' | 'danger' | 'success'
}>(), {
  tone: 'info'
})

const borderClasses = {
  info: 'border-blue-4',
  danger: 'border-red-4',
  success: 'border-success'
}

const dotClasses = {
  info: 'bg-blue-4',
  danger: 'bg-red-4',
  success: 'bg-success'
}
</script>

<template>
  <div
    :class="[
      'inline-flex items-center gap-2.5 rounded-sm border bg-ink-0 px-4 py-2.5 font-mono text-body-s text-primary shadow-card',
      borderClasses[tone]
    ]"
  >
    <span class="h-1.5 w-1.5 shrink-0 rounded-full" :class="dotClasses[tone]" />
    <slot />
  </div>
</template>
