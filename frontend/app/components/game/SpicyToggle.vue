<script setup lang="ts">
/**
 * Interrupteur "contenu hot", indépendant du thème : se combine avec
 * n'importe quel dossier thématique (Culture + Hot, Nature + Hot…) plutôt que
 * de le remplacer.
 */
const spicy = defineModel<boolean>({ default: false })

withDefaults(defineProps<{ disabled?: boolean }>(), { disabled: false })
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="spicy"
    :disabled="disabled"
    class="flex h-7 w-12 shrink-0 items-center rounded-pill border border-subtle p-0.5 transition-colors duration-150 disabled:opacity-45"
    :class="spicy ? 'bg-danger' : 'bg-surface-inset'"
    @click="spicy = !spicy"
  >
    <span
      class="size-5 rounded-pill bg-paper-0 shadow-card transition-transform duration-150"
      :class="spicy ? 'translate-x-6' : 'translate-x-0'"
    />
  </button>
</template>
