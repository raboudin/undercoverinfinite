<script setup lang="ts">
import { computed } from 'vue'
import type { Player, Winner } from '../../composables/useGame'
import logoFull from '../../assets/images/logo-full.png'

const props = defineProps<{
  winner: Exclude<Winner, null>
  players: Player[]
}>()

defineEmits<{ replay: []; newGame: [] }>()

const civilsWon = computed(() => props.winner === 'civils')

const undercovers = computed(() => props.players.filter(player => player.role === 'undercover'))
const undercoverLabel = computed(() => {
  const names = undercovers.value.map(player => player.name).join(', ')
  return undercovers.value.length > 1 ? `Agents doubles : ${names}` : `Agent double : ${names}`
})
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-col items-center gap-3">
      <img :src="logoFull" alt="Undercover Infinite" class="w-48 max-w-full object-contain" >
    </div>

    <Card :glow="civilsWon ? 'recon' : 'danger'" class="flex flex-col items-center gap-3 py-8 text-center">
      <RoleTag :tone="civilsWon ? 'ally' : 'danger'">
        {{ civilsWon ? 'Mission accomplie' : 'Mission compromise' }}
      </RoleTag>
      <div
        class="font-display text-display-l uppercase tracking-caps"
        :class="civilsWon ? 'text-blue-3' : 'text-red-4'"
      >
        {{ civilsWon ? 'Réseau assaini' : 'Réseau infiltré' }}
      </div>
      <p class="max-w-xs text-body-s text-secondary">
        <template v-if="civilsWon">
          Tous les agents doubles sont tombés. La couverture du réseau tient encore.
        </template>
        <template v-else>
          Les infiltrés sont désormais assez nombreux pour dicter leur loi. Le réseau est perdu.
        </template>
      </p>
      <p class="font-mono text-caption uppercase tracking-caps text-tertiary">
        {{ undercoverLabel }}
      </p>
    </Card>

    <div class="flex flex-col gap-3">
      <div class="font-display text-body-s uppercase tracking-caps text-tertiary">Dossiers déclassifiés</div>
      <div class="flex flex-col gap-3">
        <div v-for="player in players" :key="player.id" class="flex flex-col gap-1.5">
          <PlayerRow :name="player.name" :status="player.alive ? 'active' : 'eliminated'" />
          <div class="flex items-center gap-2 pl-4">
            <RoleTag :tone="player.role === 'undercover' ? 'danger' : 'ally'">
              {{ player.role === 'undercover' ? 'Undercover' : 'Loyal' }}
            </RoleTag>
            <span class="font-mono text-body-s text-tertiary">{{ player.word }}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="flex flex-col gap-2.5">
      <Button size="l" class="w-full" @click="$emit('replay')">Rejouer avec la même équipe</Button>
      <Button size="l" variant="ghost" class="w-full" @click="$emit('newGame')">Nouvelle mission</Button>
    </div>
  </div>
</template>
