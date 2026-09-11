/**
 * Ordre de parole d'une manche : les joueurs vivants, dans l'ordre des sièges,
 * décalés pour qu'un agent différent commence à chaque manche. Porté depuis
 * `useGame.ts`'s `speakingOrder` (computed).
 *
 * `players` doit déjà être trié par siège — la fonction ne fait que filtrer
 * les vivants puis tourner la liste.
 */
export function speakingOrder<T extends { alive: boolean }>(
  players: T[],
  round: number,
): T[] {
  const alive = players.filter((player) => player.alive);
  if (alive.length === 0) return [];
  const offset = (Math.max(round, 1) - 1) % alive.length;
  return [...alive.slice(offset), ...alive.slice(0, offset)];
}
