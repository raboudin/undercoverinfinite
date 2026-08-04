/**
 * Signal « retour au menu principal », émis par le logo de l'en-tête.
 *
 * Le logo vit dans la coque (`app.vue`) et la partie dans la page : il faut
 * bien un canal entre les deux. C'est un compteur plutôt qu'un booléen — deux
 * retours au menu d'affilée doivent réveiller le `watch` les deux fois.
 *
 * `useState` et non un `ref` de module : au rendu serveur, un `ref` de module
 * est partagé par tous les visiteurs, et la sortie de l'un renverrait l'autre
 * au menu en pleine partie. Nuxt isole `useState` par requête.
 */
export function useMissionExit() {
  return useState<number>('mission-exit', () => 0)
}
