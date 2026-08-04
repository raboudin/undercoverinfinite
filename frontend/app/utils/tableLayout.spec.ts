import { describe, expect, it } from 'vitest'
import { seatLayout } from './tableLayout'

const COUNTS = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

interface Box { left: number, right: number, top: number, bottom: number }

/** Boîtes des cartes, en % du plateau. */
function boxes(count: number): Box[] {
  const { seat, tall, positions } = seatLayout(count)
  const halfWidth = seat / 2
  const halfHeight = (seat * (tall ? 1.25 : 1)) / 2
  return positions.map(({ left, top }) => ({
    left: left - halfWidth,
    right: left + halfWidth,
    top: top - halfHeight,
    bottom: top + halfHeight
  }))
}

function overlap(a: Box, b: Box): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
}

describe('seatLayout', () => {
  it.each(COUNTS)('ne fait jamais se recouvrir deux cartes à %i agents', (count) => {
    const placed = boxes(count)
    const collisions = placed.flatMap((a, i) =>
      placed.slice(i + 1).filter(b => overlap(a, b))
    )
    expect(collisions).toHaveLength(0)
  })

  it.each(COUNTS)('garde toutes les cartes sur le plateau à %i agents', (count) => {
    for (const box of boxes(count)) {
      expect(box.left).toBeGreaterThanOrEqual(0)
      expect(box.right).toBeLessThanOrEqual(100)
      expect(box.top).toBeGreaterThanOrEqual(0)
      expect(box.bottom).toBeLessThanOrEqual(100)
    }
  })

  /** Le tableau de bord central affiche la manche, l'orateur, le mot révélé. */
  it.each(COUNTS)('laisse le centre du plateau libre à %i agents', (count) => {
    const hub = { left: 40, right: 60, top: 45, bottom: 55 }
    for (const box of boxes(count)) expect(overlap(box, hub)).toBe(false)
  })

  it('pose un siège par agent, dans le sens horaire et hors des axes', () => {
    const { positions } = seatLayout(4)

    expect(positions).toEqual([
      { left: 75.46, top: 26.67 },
      { left: 75.46, top: 73.33 },
      { left: 24.54, top: 73.33 },
      { left: 24.54, top: 26.67 }
    ])
  })

  it('rétrécit les cartes à mesure que la table se remplit', () => {
    expect(seatLayout(4).seat).toBeGreaterThan(seatLayout(8).seat)
    expect(seatLayout(8).seat).toBeGreaterThan(seatLayout(12).seat)
  })

  it('garde des cartes lisibles jusqu’à douze, et raisonnables à trois', () => {
    for (const count of COUNTS) {
      // Un nom court doit encore tenir sur la plus petite carte.
      expect(seatLayout(count).seat).toBeGreaterThan(12)
      expect(seatLayout(count).seat).toBeLessThanOrEqual(28)
    }
  })

  it('passe les cartes au carré dès que la table se remplit', () => {
    expect(seatLayout(5).tall).toBe(true)
    expect(seatLayout(6).tall).toBe(false)
  })

  it('tient bon sur une table d’un seul siège', () => {
    const { positions, seat } = seatLayout(1)
    expect(positions).toHaveLength(1)
    expect(seat).toBeGreaterThan(0)
  })
})
