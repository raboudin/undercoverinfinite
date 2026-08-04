/**
 * Placement des sièges autour de la table.
 *
 * Tout est exprimé en pourcentage du plateau, jamais en pixels : la table
 * garde ses proportions du téléphone à l'écran large sans qu'aucune mesure ne
 * soit lue dans le DOM. Le calcul vit ici plutôt que dans `GameTable` parce
 * qu'il porte la seule vraie règle du plateau — **deux cartes ne se recouvrent
 * jamais, de trois à douze agents** — et que cette règle se vérifie bien mieux
 * sur une fonction pure que sur un rendu.
 */

/** Marge intérieure du plateau : aucune carte ne va toucher le bord. */
const MARGIN = 2
/** Jeu laissé entre deux cartes voisines. */
const GAP = 0.94
/** Au-delà, une carte paraîtrait démesurée sur une petite table. */
const MAX_SEAT = 28
const MIN_SEAT = 8

/** Hauteur / largeur d'une carte, selon qu'elle est en portrait ou carrée. */
const TALL_RATIO = 1.25

export interface SeatPosition {
  /** Centre de la carte, en % de la largeur du plateau. */
  left: number
  /** Centre de la carte, en % de la hauteur du plateau. */
  top: number
}

export interface SeatLayout {
  /** Largeur d'une carte, en % de la largeur du plateau. */
  seat: number
  /** Carte en portrait (4:5) plutôt que carrée. */
  tall: boolean
  positions: SeatPosition[]
}

const round = (value: number) => Math.round(value * 100) / 100

/**
 * Angles des sièges, dans le sens horaire, **décalés d'un demi-pas**.
 *
 * Sans ce décalage une table de quatre pose une carte pile à midi et une pile
 * à six heures, qui mordent toutes deux sur le tableau de bord central. En
 * diagonale, la même carte tient largement dans son quartier.
 */
function anglesOf(count: number): number[] {
  return Array.from(
    { length: count },
    (_, index) => -Math.PI / 2 + Math.PI / count + (2 * Math.PI * index) / count
  )
}

export function seatLayout(count: number): SeatLayout {
  const total = Math.max(count, 1)
  // Une carte à jouer en portrait tant que la table reste petite ; au-delà les
  // sièges se resserrent sur les flancs de l'ellipse, où c'est la hauteur des
  // cartes qui les ferait se chevaucher.
  const tall = total <= 5
  const ratio = tall ? TALL_RATIO : 1
  const rx = 36
  const ry = tall ? 33 : 35

  const angles = anglesOf(total)

  /*
   * Deux boîtes ne se recouvrent que si elles se chevauchent **sur les deux
   * axes** : il suffit donc que deux voisines soient séparées sur un seul. Le
   * cas serré est la corde à 45°, où l'écart se répartit également entre x et
   * y — d'où le `max` plutôt qu'une simple distance.
   */
  let neighbour = Number.POSITIVE_INFINITY
  for (let index = 0; index < total && total > 1; index++) {
    const from = angles[index]!
    const to = angles[(index + 1) % total]!
    const dx = Math.abs(rx * (Math.cos(from) - Math.cos(to)))
    const dy = Math.abs(ry * (Math.sin(from) - Math.sin(to)))
    neighbour = Math.min(neighbour, Math.max(dx, dy / ratio))
  }

  // Et rien ne déborde du plateau, dans un sens comme dans l'autre.
  const maxCos = Math.max(...angles.map(angle => Math.abs(Math.cos(angle))))
  const maxSin = Math.max(...angles.map(angle => Math.abs(Math.sin(angle))))
  const fitX = 2 * (50 - MARGIN - rx * maxCos)
  const fitY = (2 * (50 - MARGIN - ry * maxSin)) / ratio

  const seat = Math.max(
    MIN_SEAT,
    Math.min(MAX_SEAT, neighbour * GAP, fitX, fitY)
  )

  return {
    seat: round(seat),
    tall,
    positions: angles.map(angle => ({
      // Le cosinus de midi vaut 6e-17, pas 0 : sans arrondi il fuiterait dans
      // l'attribut `style`.
      left: round(50 + rx * Math.cos(angle)),
      top: round(50 + ry * Math.sin(angle))
    }))
  }
}
