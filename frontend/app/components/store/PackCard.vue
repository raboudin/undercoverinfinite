<script setup lang="ts">
import { computed } from 'vue'
import { Check, Infinity as InfinityIcon, Palette, Wallet } from '@lucide/vue'
import type { ModeId, PackDefinition } from '../../composables/useEntitlements'

const props = withDefaults(defineProps<{
  pack: PackDefinition & { owned: boolean }
  /** Libellés des modes, pour ne pas réécrire le catalogue ici. */
  modeLabels?: Record<string, string>
  /** Plafond quotidien des packs illimités, annoncé tel quel. */
  unlimitedDailyCredits?: number
  /** Sans compte, un pack ne peut pas être rattaché. */
  account?: boolean
  pending?: boolean
}>(), {
  modeLabels: () => ({}),
  unlimitedDailyCredits: 50,
  account: true,
  pending: false
})

const emit = defineEmits<{ unlock: [], signIn: [] }>()

const price = computed(() =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(
    props.pack.priceEur
  )
)

const modeNames = computed(() =>
  props.pack.modes.map((mode: ModeId) => props.modeLabels[mode] ?? mode)
)
</script>

<template>
  <Card :glow="pack.owned ? 'recon' : null" class="flex flex-col gap-4">
    <div class="flex items-start justify-between gap-3">
      <div>
        <div class="font-display text-title uppercase tracking-caps text-primary">{{ pack.label }}</div>
        <p class="mt-1 max-w-xs text-body-s text-secondary">{{ pack.tagline }}</p>
      </div>
      <div class="shrink-0 text-right">
        <div class="font-display text-display-s text-primary">{{ price }}</div>
        <!-- Le paiement n'est pas branché : le pack se rattache gratuitement,
             et cette mention évite de laisser croire à un prélèvement. -->
        <div class="font-mono text-caption text-amber-4">offert au lancement</div>
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <div v-if="pack.credits > 0" class="flex items-center gap-2">
        <Wallet :size="14" class="shrink-0 text-blue-3" />
        <span class="font-mono text-caption text-secondary">
          {{ pack.credits }} missions ajoutées à ta réserve, sans date limite
        </span>
      </div>

      <div v-if="pack.unlimited" class="flex items-center gap-2">
        <InfinityIcon :size="14" class="shrink-0 text-blue-3" />
        <span class="font-mono text-caption text-secondary">
          Missions illimitées, jusqu’à {{ unlimitedDailyCredits }} par jour
        </span>
      </div>

      <div v-if="modeNames.length > 0" class="flex items-center gap-2">
        <Check :size="14" class="shrink-0 text-blue-3" />
        <span class="font-mono text-caption text-secondary">
          Modes : {{ modeNames.join(', ') }}
        </span>
      </div>

      <div class="flex items-center gap-2">
        <Palette :size="14" class="shrink-0 text-blue-3" />
        <span class="font-mono text-caption text-secondary">
          {{ pack.allThemes ? 'Tous les thèmes, y compris les dossiers spécialisés' : 'Thèmes généralistes' }}
        </span>
      </div>
    </div>

    <div v-if="pack.owned" class="flex items-center gap-2">
      <RoleTag tone="ally">Rattaché à ton dossier</RoleTag>
    </div>
    <Button
      v-else-if="!account"
      variant="ghost"
      class="w-full"
      @click="emit('signIn')"
    >
      Créer un dossier d’agent
    </Button>
    <Button
      v-else
      class="w-full"
      :disabled="pending"
      @click="emit('unlock')"
    >
      Débloquer
    </Button>
  </Card>
</template>
