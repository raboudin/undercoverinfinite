<script setup lang="ts">
import { computed, onMounted } from 'vue'
import type { PackId } from '~/composables/useEntitlements'

const entitlements = useNuxtApp().$entitlements
const {
  status,
  account,
  credits,
  catalog,
  packCards,
  pending,
  error,
  refresh,
  unlock
} = entitlements

// Les droits dépendent des cookies httpOnly, que le rendu serveur ne relaie
// pas : la boutique se peuple après l'hydratation, comme le bandeau de compte.
onMounted(() => {
  if (status.value !== 'ready') void refresh()
})

/** Libellés des modes, pris du catalogue serveur plutôt que redéclarés ici. */
const modeLabels = computed(() =>
  Object.fromEntries((catalog.value?.modes ?? []).map(mode => [mode.id, mode.label]))
)

async function claim(pack: PackId) {
  await unlock(pack)
}
</script>

<template>
  <div class="flex flex-col gap-6">
    <div class="flex flex-col gap-2">
      <h1 class="font-display text-display-s uppercase tracking-caps text-primary">Équipement</h1>
      <p class="text-body-s text-secondary">
        Chaque pack ouvre des modes de mission et des dossiers thématiques. Il se rattache à ton
        dossier d’agent, pas à ce téléphone : tu le retrouves partout où tu te connectes.
      </p>
    </div>

    <Card v-if="status === 'ready'" class="flex items-center justify-between gap-4">
      <div>
        <div class="font-display text-body-s uppercase tracking-caps text-secondary">Missions restantes</div>
        <div class="mt-0.5 font-mono text-caption text-tertiary">
          <template v-if="credits.unlimited">plafond quotidien de {{ credits.dailyLimit }}</template>
          <template v-else>{{ credits.dailyLimit }} par jour, remise à zéro à minuit</template>
        </div>
      </div>
      <span class="font-display text-display-s text-primary">{{ credits.remaining }}</span>
    </Card>

    <Toast v-if="!account && status === 'ready'" tone="info">
      Un dossier d’agent est nécessaire pour rattacher un pack.
    </Toast>

    <Toast v-if="error" tone="danger">{{ error }}</Toast>

    <p v-if="status === 'loading' || status === 'idle'" class="font-mono text-caption text-tertiary">
      Contact du QG… inventaire de l’équipement.
    </p>

    <template v-else-if="status === 'error'">
      <p class="text-body-s text-secondary">
        Impossible de joindre le QG. Vérifie ta connexion, puis réessaie.
      </p>
      <Button size="s" variant="ghost" class="self-start" @click="refresh()">
        Réessayer
      </Button>
    </template>

    <div v-else class="flex flex-col gap-4">
      <PackCard
        v-for="pack in packCards"
        :key="pack.id"
        :pack="pack"
        :mode-labels="modeLabels"
        :unlimited-daily-credits="catalog?.unlimitedDailyCredits ?? 50"
        :account="account"
        :pending="pending"
        @unlock="claim(pack.id)"
        @sign-in="navigateTo('/connexion')"
      />
    </div>

    <Button variant="ghost" size="l" class="w-full" @click="navigateTo('/')">
      Retour au terrain
    </Button>
  </div>
</template>
