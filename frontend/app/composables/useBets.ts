/**
 * Comptes du mode « pari risqué ».
 *
 * **L'application ne gère aucun paiement** : elle tient le tableau, les
 * joueurs se règlent entre eux hors de l'app. Rien ici ne touche à un moyen
 * de paiement, et aucune somme n'est stockée ailleurs que dans l'état de la
 * partie en cours.
 */

export interface Bet {
  /** Agent qui mise. */
  playerId: string
  /** Agent soupçonné. Jamais soi-même — la règle serait sans risque. */
  targetId: string
  /** Mise, dans l'unité choisie par la table. Doit être positive ou nulle. */
  stake: number
}

export interface Settlement {
  playerId: string
  targetId: string
  stake: number
  /** Le suspect désigné était bien un undercover. */
  won: boolean
  /** Solde net : positif = à recevoir, négatif = à payer. La somme fait zéro. */
  net: number
}

/** Convertit en centimes pour compter juste, puis revient en unités. */
function toCents(value: number): number {
  return Math.round(value * 100)
}

function fromCents(cents: number): number {
  return cents / 100
}

/**
 * Répartit les mises à la révélation des rôles.
 *
 * Règle : celui qui a désigné un undercover récupère sa mise et se partage
 * celles des perdants, au prorata de ce qu'il a engagé. Si personne n'a vu
 * juste — ou si tout le monde a vu juste — chacun reprend sa mise et la partie
 * est nulle.
 *
 * Les undercovers misent aussi : leur seul pari gagnant est de désigner un
 * complice, ce qui les expose. C'est la contrepartie du rôle.
 */
export function settleStakes(
  bets: Bet[],
  isUndercover: (playerId: string) => boolean
): Settlement[] {
  const outcomes = bets.map(bet => ({ bet, won: isUndercover(bet.targetId) }))
  const winners = outcomes.filter(outcome => outcome.won)
  const losers = outcomes.filter(outcome => !outcome.won)

  const potCents = losers.reduce((sum, outcome) => sum + toCents(outcome.bet.stake), 0)
  const engagedCents = winners.reduce((sum, outcome) => sum + toCents(outcome.bet.stake), 0)

  // Sans gagnant, ou sans perdant, il n'y a rien à déplacer : tout le monde
  // reprend sa mise plutôt que de créer de la valeur à partir de rien.
  const nothingMoves = winners.length === 0 || losers.length === 0 || engagedCents === 0

  // Le dernier gagnant absorbe l'arrondi (quelques centimes au plus), sinon la
  // somme des soldes ne tomberait pas exactement à zéro.
  const lastWinnerIndex = outcomes.reduce(
    (last, outcome, index) => (outcome.won ? index : last),
    -1
  )

  let distributed = 0
  return outcomes.map(({ bet, won }, index) => {
    if (nothingMoves) return { ...bet, won, net: 0 }
    if (!won) return { ...bet, won, net: -bet.stake }

    const shareCents = index === lastWinnerIndex
      ? potCents - distributed
      : Math.floor((potCents * toCents(bet.stake)) / engagedCents)
    distributed += shareCents

    return { ...bet, won, net: fromCents(shareCents) }
  })
}

/** Total en jeu sur la table, pour l'annoncer avant la révélation. */
export function potOf(bets: Bet[]): number {
  return fromCents(bets.reduce((sum, bet) => sum + toCents(bet.stake), 0))
}
