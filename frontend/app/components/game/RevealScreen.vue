<script setup lang="ts">
import { ref, watch } from 'vue'
import { Eye } from '@lucide/vue'
import type { Player } from '../../composables/useGame'

const props = defineProps<{
  player: Player
  index: number
  total: number
  isLast: boolean
}>()

const emit = defineEmits<{ next: [] }>()

const revealed = ref(false)

// Le dossier se referme dès que le téléphone change de mains : sans ça, le mot
// du joueur précédent resterait affiché sous les yeux du suivant.
watch(() => props.player.id, () => {
  revealed.value = false
})

function pass() {
  revealed.value = false
  emit('next')
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex items-center justify-between">
      <span class="font-display text-body-s uppercase tracking-caps text-tertiary">Distribution des dossiers</span>
      <span class="font-mono text-caption text-secondary">{{ index + 1 }} / {{ total }}</span>
    </div>

    <Card :glow="revealed ? 'danger' : 'recon'" class="flex flex-col items-center gap-5 py-9 text-center">
      <Avatar :initial="player.name[0]" :size="72" />

      <div class="flex flex-col items-center gap-2">
        <div class="font-display text-display-s uppercase tracking-caps text-primary">{{ player.name }}</div>
        <RoleTag :tone="revealed ? 'danger' : 'classified'">
          {{ revealed ? 'Dossier ouvert' : 'Dossier scellé' }}
        </RoleTag>
      </div>

      <template v-if="revealed">
        <div class="flex w-full flex-col items-center gap-2 border-y border-subtle bg-surface-inset py-6">
          <span class="font-mono text-caption uppercase tracking-caps text-tertiary">Ton mot de couverture</span>
          <span class="font-display text-display-m uppercase tracking-caps text-red-4">{{ player.word }}</span>
        </div>
        <p class="max-w-xs text-body-s text-secondary">
          Mémorise-le. Ne le prononce jamais à voix haute — il te trahirait.
        </p>
      </template>

      <template v-else>
        <p class="max-w-xs text-body-s text-secondary">
          Prends le téléphone, {{ player.name }}. Assure-toi que personne ne regarde par-dessus ton épaule.
        </p>
      </template>
    </Card>

    <Button v-if="!revealed" size="l" class="w-full" @click="revealed = true">
      <Eye :size="18" />
      Ouvrir le dossier
    </Button>

    <Button v-else size="l" variant="secondary" class="w-full" @click="pass()">
      {{ isLast ? 'Tout le monde est briefé' : 'C’est mémorisé — passe le téléphone' }}
    </Button>
  </div>
</template>
