export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 12;

/**
 * Les civils restent strictement majoritaires au lancement — même règle que
 * `useGame.ts`'s `maxUndercovers`. Ce n'est plus une question de règle (les
 * undercovers ne gagnent qu'en étant *plus nombreux*), mais d'intérêt : une
 * table qui démarre à égalité se joue sur une seule élimination.
 */
export function maxUndercovers(playerCount: number): number {
  return Math.floor((playerCount - 1) / 2);
}

export function validatePlayerCount(playerCount: number): string | null {
  if (playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) {
    return `Il faut entre ${MIN_PLAYERS} et ${MAX_PLAYERS} agents dans la salle.`;
  }
  return null;
}

export function validateUndercoverCount(
  playerCount: number,
  undercoverCount: number,
): string | null {
  const ceiling = maxUndercovers(playerCount);
  if (undercoverCount < 1 || undercoverCount > ceiling) {
    return `Pour ${playerCount} agents, il faut entre 1 et ${ceiling} undercover${ceiling > 1 ? 's' : ''}.`;
  }
  return null;
}
