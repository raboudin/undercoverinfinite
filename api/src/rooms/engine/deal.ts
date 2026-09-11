export type Role = 'civil' | 'undercover';

export interface WordPairInput {
  a: string;
  b: string;
}

export interface DealAssignment {
  playerId: string;
  seat: number;
  role: Role;
  word: string;
}

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const swap = out[i]!;
    out[i] = out[j]!;
    out[j] = swap;
  }
  return out;
}

/**
 * Distribue rôles, mots et sièges à des joueurs déjà réunis dans le lobby.
 * Porté depuis `useGame.ts`'s `deal()` : même tirage à pile ou face du mot
 * confié aux civils, même mélange des rôles avant de les poser sur les sièges.
 *
 * `playerIds` doit déjà être dans l'ordre des sièges (arrivée en salle) — la
 * fonction ne trie rien, elle numérote seulement.
 */
export function dealRoles(
  playerIds: string[],
  undercoverCount: number,
  pair: WordPairInput,
  rng: () => number = Math.random,
): DealAssignment[] {
  const civilsTakeA = rng() < 0.5;
  const civilWord = civilsTakeA ? pair.a : pair.b;
  const undercoverWord = civilsTakeA ? pair.b : pair.a;

  const roles = shuffle(
    playerIds.map<Role>((_, i) => (i < undercoverCount ? 'undercover' : 'civil')),
    rng,
  );

  return playerIds.map((playerId, seat) => {
    const role = roles[seat]!;
    return {
      playerId,
      seat,
      role,
      word: role === 'undercover' ? undercoverWord : civilWord,
    };
  });
}
