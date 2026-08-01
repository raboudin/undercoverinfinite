<script setup lang="ts">
withDefaults(defineProps<{
  name: string
  status?: 'active' | 'away' | 'eliminated'
  isHost?: boolean
  actionLabel?: string
}>(), {
  status: 'active',
  isHost: false
})

defineEmits<{ action: [] }>()

const statusDot = {
  active: 'online',
  away: 'away',
  eliminated: 'eliminated'
} as const
</script>

<template>
  <div
    class="flex items-center gap-3 rounded-sm border border-subtle bg-surface px-4 py-3"
    :class="status === 'eliminated' ? 'opacity-55' : 'opacity-100'"
  >
    <Avatar :initial="name?.[0]" :status="statusDot[status]" :size="32" />
    <span
      class="flex-1 font-medium text-primary"
      :class="status === 'eliminated' ? 'line-through' : ''"
    >
      {{ name }}
    </span>
    <span v-if="isHost" class="font-mono text-[10px] uppercase text-amber-4">hôte</span>
    <button
      v-if="actionLabel"
      class="cursor-pointer rounded-sm border border-danger px-3 py-1.5 font-display text-caption uppercase tracking-caps text-red-4"
      @click="$emit('action')"
    >
      {{ actionLabel }}
    </button>
  </div>
</template>
