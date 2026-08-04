<script setup lang="ts">
/**
 * Confirmation avant de quitter la session.
 *
 * Le bouton de déconnexion vit dans l'en-tête, à deux doigts du logo et de la
 * boutique : sur un téléphone passé de main en main pendant une partie, un
 * appui de travers ne doit pas fermer le dossier.
 *
 * Composant partagé entre l'en-tête (`AccountButton`) et le dossier
 * (`AgentDossier`) pour que la question soit posée dans les mêmes termes des
 * deux côtés.
 */
withDefaults(defineProps<{
  open: boolean
  pending?: boolean
}>(), {
  pending: false
})

const emit = defineEmits<{ confirm: [], cancel: [] }>()
</script>

<template>
  <Modal :open="open" title="Quitter le QG ?" @close="emit('cancel')">
    <div class="flex flex-col gap-5">
      <p class="max-w-xs text-body-s text-secondary">
        Ta session sera fermée sur cet appareil. Ton dossier d'agent reste intact,
        tu le retrouveras à la prochaine connexion — et les parties en pass-and-play
        continuent sans compte.
      </p>
      <div class="flex flex-wrap justify-end gap-2.5">
        <Button size="s" variant="ghost" @click="emit('cancel')">
          Rester en poste
        </Button>
        <Button size="s" variant="danger" :disabled="pending" @click="emit('confirm')">
          {{ pending ? 'Sortie…' : 'Se déconnecter' }}
        </Button>
      </div>
    </div>
  </Modal>
</template>
