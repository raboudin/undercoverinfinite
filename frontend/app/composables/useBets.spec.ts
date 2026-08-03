import { describe, expect, it } from 'vitest'
import { potOf, settleStakes, type Bet } from './useBets'

/** Somme des soldes : elle doit toujours tomber pile à zéro. */
function totalNet(settlement: { net: number }[]): number {
  return Math.round(settlement.reduce((sum, row) => sum + row.net, 0) * 100) / 100
}

describe('settleStakes', () => {
  const isUndercover = (id: string) => id === 'agent-u'

  it('les gagnants se partagent les mises des perdants au prorata', () => {
    const bets: Bet[] = [
      { playerId: 'a', targetId: 'agent-u', stake: 10 }, // vu juste
      { playerId: 'b', targetId: 'agent-u', stake: 30 }, // vu juste
      { playerId: 'c', targetId: 'agent-x', stake: 20 } // à côté
    ]

    const settlement = settleStakes(bets, isUndercover)

    // Pot des perdants = 20, réparti 1/4 – 3/4 selon les mises engagées.
    expect(settlement.map(row => row.net)).toEqual([5, 15, -20])
    expect(totalNet(settlement)).toBe(0)
  })

  it('rend sa mise à chacun si personne n’a vu juste', () => {
    const bets: Bet[] = [
      { playerId: 'a', targetId: 'agent-x', stake: 10 },
      { playerId: 'b', targetId: 'agent-y', stake: 5 }
    ]

    const settlement = settleStakes(bets, isUndercover)

    expect(settlement.every(row => row.net === 0)).toBe(true)
    expect(settlement.every(row => row.won === false)).toBe(true)
  })

  it('rend sa mise à chacun si tout le monde a vu juste', () => {
    const bets: Bet[] = [
      { playerId: 'a', targetId: 'agent-u', stake: 10 },
      { playerId: 'b', targetId: 'agent-u', stake: 5 }
    ]

    const settlement = settleStakes(bets, isUndercover)

    expect(settlement.every(row => row.net === 0)).toBe(true)
    expect(settlement.every(row => row.won === true)).toBe(true)
  })

  it('marque qui avait vu juste', () => {
    const bets: Bet[] = [
      { playerId: 'a', targetId: 'agent-u', stake: 1 },
      { playerId: 'b', targetId: 'agent-x', stake: 1 }
    ]

    expect(settleStakes(bets, isUndercover).map(row => row.won)).toEqual([true, false])
  })

  it('boucle exactement même quand la répartition tombe mal', () => {
    const bets: Bet[] = [
      { playerId: 'a', targetId: 'agent-u', stake: 1 },
      { playerId: 'b', targetId: 'agent-u', stake: 1 },
      { playerId: 'c', targetId: 'agent-u', stake: 1 },
      { playerId: 'd', targetId: 'agent-x', stake: 10 }
    ]

    const settlement = settleStakes(bets, isUndercover)

    // 10 € pour trois gagnants : 3,33 + 3,33 + 3,34, et rien ne se perd.
    expect(totalNet(settlement)).toBe(0)
    expect(settlement[3]?.net).toBe(-10)
  })

  it('gère les centimes sans dérive de flottant', () => {
    const bets: Bet[] = [
      { playerId: 'a', targetId: 'agent-u', stake: 0.1 },
      { playerId: 'b', targetId: 'agent-x', stake: 0.2 }
    ]

    const settlement = settleStakes(bets, isUndercover)

    expect(settlement[0]?.net).toBe(0.2)
    expect(settlement[1]?.net).toBe(-0.2)
  })

  it('accepte une mise nulle : l’agent ne gagne ni ne perd rien', () => {
    const bets: Bet[] = [
      { playerId: 'a', targetId: 'agent-u', stake: 0 },
      { playerId: 'b', targetId: 'agent-u', stake: 10 },
      { playerId: 'c', targetId: 'agent-x', stake: 10 }
    ]

    const settlement = settleStakes(bets, isUndercover)

    expect(settlement[0]?.net).toBe(0)
    expect(settlement[1]?.net).toBe(10)
    expect(totalNet(settlement)).toBe(0)
  })

  it('ne déplace rien sans pari', () => {
    expect(settleStakes([], isUndercover)).toEqual([])
  })
})

describe('potOf', () => {
  it('additionne les mises de la table', () => {
    expect(
      potOf([
        { playerId: 'a', targetId: 'b', stake: 2.5 },
        { playerId: 'b', targetId: 'a', stake: 1.25 }
      ])
    ).toBe(3.75)
  })
})
