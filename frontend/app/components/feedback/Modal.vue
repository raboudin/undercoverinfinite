<script setup lang="ts">
defineProps<{
  open: boolean
  title?: string
}>()

defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[100] flex items-center justify-center bg-ink-0/[0.72] backdrop-blur-[3px]"
      @click="$emit('close')"
    >
      <div
        class="min-w-[320px] max-w-[90vw] rounded-md border border-default bg-surface-raised p-6 shadow-modal"
        @click.stop
      >
        <div v-if="title" class="mb-4 font-display text-title uppercase tracking-caps text-red-4">
          {{ title }}
        </div>
        <slot />
      </div>
    </div>
  </Teleport>
</template>
