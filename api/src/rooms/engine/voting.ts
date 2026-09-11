/**
 * Nombre de tentatives de vote avant tirage au sort. Le pass-and-play local
 * n'a jamais eu d'égalité (consensus verbal, un seul nom tapé) : en ligne,
 * chaque agent vote pour son propre compte, une égalité est possible, et sans
 * plafond un groupe indécis ferait tourner la partie indéfiniment.
 */
export const MAX_VOTE_ATTEMPTS = 3;

export interface VoteRow {
  targetId: string;
}

export type VoteTallyResult =
  | { outcome: 'eliminate'; targetId: string; wasRandomTiebreak: boolean }
  | { outcome: 'tie'; tiedPlayerIds: string[] };

/**
 * Dépouille un tour de vote complet (tous les vivants ont voté sur la
 * tentative courante). Vainqueur net → élimination. Égalité entre plusieurs
 * cibles : revote tant que `attempt < MAX_VOTE_ATTEMPTS`, sinon tirage au sort
 * parmi les ex-aequo pour garantir que la partie avance.
 */
export function resolveVotes(
  votes: VoteRow[],
  attempt: number,
  rng: () => number = Math.random,
): VoteTallyResult {
  const counts = new Map<string, number>();
  for (const vote of votes) {
    counts.set(vote.targetId, (counts.get(vote.targetId) ?? 0) + 1);
  }

  let max = 0;
  for (const count of counts.values()) max = Math.max(max, count);

  const tied = [...counts.entries()]
    .filter(([, count]) => count === max)
    .map(([targetId]) => targetId);

  if (tied.length === 1) {
    return { outcome: 'eliminate', targetId: tied[0]!, wasRandomTiebreak: false };
  }

  if (attempt < MAX_VOTE_ATTEMPTS) {
    return { outcome: 'tie', tiedPlayerIds: tied };
  }

  const pick = tied[Math.floor(rng() * tied.length)]!;
  return { outcome: 'eliminate', targetId: pick, wasRandomTiebreak: true };
}
