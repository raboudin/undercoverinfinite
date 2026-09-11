export type Winner = 'civils' | 'undercovers' | null;

/**
 * Deux fins possibles, et deux seulement — même règle que
 * `useGame.ts`'s `resolveElimination` : plus aucun undercover en vie, ou des
 * undercovers **strictement plus nombreux** que les loyaux. À égalité la
 * partie continue, ce qui laisse une dernière manche en tête-à-tête.
 */
export function checkVictory(aliveUndercovers: number, aliveCivils: number): Winner {
  if (aliveUndercovers === 0) return 'civils';
  if (aliveUndercovers > aliveCivils) return 'undercovers';
  return null;
}
