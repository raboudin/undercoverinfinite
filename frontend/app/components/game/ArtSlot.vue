<script setup lang="ts">
import { ref, watch } from 'vue'

/**
 * Emplacement d'illustration qui survit à l'absence de fichier.
 *
 * Les visuels des modes et des thèmes arrivent après l'interface : sans image,
 * on affiche un cartouche de dossier (monogramme sur trame) plutôt que l'icône
 * d'image cassée du navigateur. `src` vaut `null` tant que le fichier n'a pas
 * été déposé (cf. `gameArt`), donc aucune requête n'est même tentée ; le
 * `@error` ne couvre que le cas d'un fichier présent mais illisible.
 */
const props = withDefaults(defineProps<{
  src?: string | null
  alt?: string
  /** Lettres du cartouche de repli. Le libellé du mode ou du thème fait l'affaire. */
  monogram?: string
}>(), {
  src: null,
  alt: '',
  monogram: ''
})

const failed = ref(false)

// Le carrousel réutilise le même composant d'un thème à l'autre : sans ça, un
// seul visuel manquant condamnerait tous les suivants au cartouche.
watch(() => props.src, () => {
  failed.value = false
})

/** Deux lettres suffisent, et « Pop culture » ne doit pas devenir « PO ». */
function initials(label: string): string {
  const words = label.split(/[\s-]+/).filter(Boolean)
  if (words.length === 0) return '??'
  if (words.length === 1) return words[0]!.slice(0, 2).toLocaleUpperCase()
  return (words[0]![0]! + words[1]![0]!).toLocaleUpperCase()
}
</script>

<template>
  <div class="relative overflow-hidden bg-surface-inset">
    <img
      v-if="src && !failed"
      :src="src"
      :alt="alt"
      class="h-full w-full object-cover"
      @error="failed = true"
    >
    <div
      v-else
      class="dossier-texture flex h-full w-full items-center justify-center bg-ink-2"
      aria-hidden="true"
    >
      <span class="font-display text-display-s uppercase tracking-caps text-steel-1">
        {{ initials(monogram || alt) }}
      </span>
    </div>
  </div>
</template>
