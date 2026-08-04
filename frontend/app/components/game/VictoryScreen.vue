<script setup lang="ts">
import { computed } from 'vue'
import type { Settlement } from '../../composables/useBets'
import type { Player, Winner } from '../../composables/useGame'
import logoFull from '../../assets/images/logo-full.png'

const props = withDefaults(defineProps<{
  winner: Exclude<Winner, null>
  players: Player[]
  /** Rejouer consomme une mission : à false quand le quota du jour est épuisé. */
  canReplay?: boolean
  /** Mode pari risqué : le décompte des mises, vide dans les autres modes. */
  settlement?: Settlement[]
}>(), {
  canReplay: true,
  settlement: () => []
})

defineEmits<{ replay: []; newGame: [] }>()

const civilsWon = computed(() => props.winner === 'civils')

const undercovers = computed(() => props.players.filter(player => player.role === 'undercover'))
const undercoverLabel = computed(() => {
  const names = undercovers.value.map(player => player.name).join(', ')
  return undercovers.value.length > 1 ? `Agents doubles : ${names}` : `Agent double : ${names}`
})

const nameOf = (id: string) => props.players.find(player => player.id === id)?.name ?? '—'

/** Soldes affichés du plus gros gain à la plus grosse perte. */
const ranked = computed(() => [...props.settlement].sort((a, b) => b.net - a.net))

/** Personne n'a vu juste (ou tout le monde) : chacun reprend sa mise. */
const noMoneyMoved = computed(
  () => props.settlement.length > 0 && props.settlement.every(row => row.net === 0)
)

function signed(net: number): string {
  return `${net > 0 ? '+' : ''}${net}`
}
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

    <div v-if="settlement.length > 0" class="flex flex-col gap-3">
      <div class="font-display text-body-s uppercase tracking-caps text-tertiary">Règlement des paris</div>

      <Card class="flex flex-col gap-2.5">
        <p v-if="noMoneyMoved" class="font-mono text-caption text-tertiary">
          Personne n’a fait la différence : chacun reprend sa mise.
        </p>

        <div
          v-for="row in ranked"
          :key="row.playerId"
          class="flex items-center justify-between gap-3 border-b border-subtle pb-2 last:border-0 last:pb-0"
        >
          <div class="min-w-0">
            <div class="truncate font-medium text-primary">{{ nameOf(row.playerId) }}</div>
            <div class="font-mono text-caption text-tertiary">
              misait {{ row.stake }} sur {{ nameOf(row.targetId) }}
            </div>
          </div>
          <div class="flex shrink-0 items-center gap-2">
            <RoleTag :tone="row.won ? 'ally' : 'neutral'">
              {{ row.won ? 'Vu juste' : 'À côté' }}
            </RoleTag>
            <span
              class="w-14 text-right font-mono text-body"
              :class="row.net > 0 ? 'text-blue-3' : row.net < 0 ? 'text-red-4' : 'text-tertiary'"
            >
              {{ signed(row.net) }}
            </span>
          </div>
        </div>
      </Card>

      <p class="font-mono text-caption text-tertiary">
        L’app tient les comptes, pas la caisse : réglez-vous entre vous.
      </p>
    </div>

    <div class="flex flex-col gap-2.5">
      <Button size="l" class="w-full" :disabled="!canReplay" @click="$emit('replay')">
        Rejouer avec la même équipe
      </Button>
      <p v-if="!canReplay" class="text-center font-mono text-caption text-tertiary">
        Plus de missions aujourd'hui — reviens demain, ou prends un pack.
      </p>
      <Button size="l" variant="ghost" class="w-full" @click="$emit('newGame')">Nouvelle mission</Button>
    </div>
  </div>
</template>
