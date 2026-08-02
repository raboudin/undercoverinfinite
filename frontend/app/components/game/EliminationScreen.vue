<script setup lang="ts">
import { computed } from 'vue'
import type { Player } from '../../composables/useGame'

const props = defineProps<{ player: Player }>()

defineEmits<{ next: [] }>()

const wasUndercover = computed(() => props.player.role === 'undercover')
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="font-display text-body-s uppercase tracking-caps text-tertiary">Couverture grillée</div>

    <Card glow="danger" class="flex flex-col items-center gap-5 py-9 text-center">
      <Avatar :initial="player.name[0]" status="eliminated" :size="72" />

      <div class="flex flex-col items-center gap-2">
        <div class="font-display text-display-s uppercase tracking-caps text-primary line-through">
          {{ player.name }}
        </div>
        <RoleTag :tone="wasUndercover ? 'danger' : 'ally'">
          {{ wasUndercover ? 'Agent double' : 'Agent loyal' }}
        </RoleTag>
      </div>

      <div class="flex w-full flex-col items-center gap-1.5 border-y border-subtle bg-surface-inset py-5">
        <span class="font-mono text-caption uppercase tracking-caps text-tertiary">Son mot de couverture</span>
        <span class="font-display text-display-s uppercase tracking-caps text-secondary">{{ player.word }}</span>
      </div>

      <p class="max-w-xs text-body-s text-secondary">
        <template v-if="wasUndercover">
          Bien joué — le réseau vient de neutraliser un infiltré.
        </template>
        <template v-else>
          Erreur de jugement. Vous venez de griller un des vôtres.
        </template>
      </p>
    </Card>

    <Button size="l" class="w-full" @click="$emit('next')">
      Débriefing
    </Button>
  </div>
</template>
