import { describe, expect, it } from 'vitest'
import {
  createGame,
  DEFAULT_TIMER_SECONDS,
  MAX_PLAYERS,
  maxUndercovers,
  type Game,
  type GameConfig,
  type Player
} from './useGame'

// mulberry32 : un PRNG déterministe, pour que la distribution des rôles soit
// reproductible d'un run à l'autre.
function seeded(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SIX = ['Marion', 'Karim', 'Sami', 'Léa', 'Youssef', 'Nadia']

// Les mots viennent de l'appelant, qui les a obtenus du serveur contre un
// crédit : les tests en injectent une paire fixe.
const PAIR = { a: 'Café', b: 'Thé' }

function newGame(names: string[] = SIX, undercoverCount = 1, seed = 42): Game {
  const game = createGame({ rng: seeded(seed) })
  game.configure({ names, undercoverCount, mode: 'classique' }, { pair: PAIR })
  return game
}

/** Partie dans un mode donné, prête à jouer. */
function gameInMode(config: Partial<GameConfig> & Pick<GameConfig, 'mode'>, challenge?: string): Game {
  const game = createGame({ rng: seeded(42) })
  game.configure(
    { names: SIX, undercoverCount: 1, ...config },
    { pair: PAIR, challenge }
  )
  return game
}

function finishReveal(game: Game) {
  while (game.phase.value === 'reveal') game.nextReveal()
}

function finishDescription(game: Game) {
  while (game.phase.value === 'describe') game.nextSpeaker()
}

/** Élimine un joueur vivant du rôle demandé et enchaîne sur la résolution. */
function eliminateOne(game: Game, role: Player['role']) {
  const target = game.alivePlayers.value.find(player => player.role === role)!
  game.eliminate(target.id)
  game.resolveElimination()
  return target
}

/** Joue une manche complète jusqu'au vote, puis élimine un joueur du rôle demandé. */
function playRoundAndEliminate(game: Game, role: Player['role']) {
  finishDescription(game)
  return eliminateOne(game, role)
}

describe('maxUndercovers', () => {
  it.each([
    [3, 1],
    [4, 1],
    [5, 2],
    [6, 2],
    [7, 3],
    [12, 5]
  ])('autorise %i agents -> %i undercovers au maximum', (playerCount, expected) => {
    expect(maxUndercovers(playerCount)).toBe(expected)
  })
})

describe('createGame — configuration', () => {
  it('démarre en phase setup, sans joueurs', () => {
    const game = createGame()
    expect(game.phase.value).toBe('setup')
    expect(game.players.value).toEqual([])
    expect(game.error.value).toBeNull()
  })

  it('passe en phase reveal et efface l’erreur quand la config est valide', () => {
    const game = createGame({ rng: seeded(1) })
    expect(game.configure({ names: SIX, undercoverCount: 2, mode: 'classique' }, { pair: PAIR })).toBe(true)
    expect(game.phase.value).toBe('reveal')
    expect(game.error.value).toBeNull()
    expect(game.round.value).toBe(0)
  })

  it('refuse moins de 3 agents ou plus que le maximum', () => {
    const game = createGame()
    expect(game.configure({ names: ['Marion', 'Karim'], undercoverCount: 1, mode: 'classique' }, { pair: PAIR })).toBe(false)
    expect(game.phase.value).toBe('setup')
    expect(game.error.value).toContain('entre 3 et 12')

    const tooMany = Array.from({ length: MAX_PLAYERS + 1 }, (_, i) => `Agent ${i}`)
    expect(game.configure({ names: tooMany, undercoverCount: 1, mode: 'classique' }, { pair: PAIR })).toBe(false)
    expect(game.phase.value).toBe('setup')
  })

  it('refuse un nom de code vide, espaces compris', () => {
    const game = createGame()
    expect(game.configure({ names: ['Marion', '   ', 'Sami'], undercoverCount: 1, mode: 'classique' }, { pair: PAIR })).toBe(false)
    expect(game.error.value).toContain('nom de code')
  })

  it('refuse les doublons sans tenir compte de la casse', () => {
    const game = createGame()
    expect(game.configure({ names: ['Marion', 'marion', 'Sami'], undercoverCount: 1, mode: 'classique' }, { pair: PAIR })).toBe(false)
    expect(game.error.value).toContain('même nom de code')
  })

  it('refuse un nombre d’undercovers hors bornes', () => {
    const game = createGame()
    expect(game.configure({ names: SIX, undercoverCount: 0, mode: 'classique' }, { pair: PAIR })).toBe(false)
    expect(game.error.value).toContain('entre 1 et 2')

    // 6 agents plafonnent à 2 undercovers : à 3 les civils ne seraient plus majoritaires.
    expect(game.configure({ names: SIX, undercoverCount: 3, mode: 'classique' }, { pair: PAIR })).toBe(false)
    expect(game.phase.value).toBe('setup')
  })

  it('nettoie les espaces autour des noms de code', () => {
    const game = newGame(['  Marion ', 'Karim', 'Sami  '], 1)
    expect(game.players.value.map(player => player.name)).toEqual(['Marion', 'Karim', 'Sami'])
  })
})

describe('createGame — distribution des rôles', () => {
  it('assigne exactement le nombre d’undercovers demandé', () => {
    const game = newGame(SIX, 2)
    expect(game.players.value.filter(player => player.role === 'undercover')).toHaveLength(2)
    expect(game.players.value.filter(player => player.role === 'civil')).toHaveLength(4)
    expect(game.players.value.every(player => player.alive)).toBe(true)
  })

  it('donne un mot commun aux civils et un autre, différent, aux undercovers', () => {
    const game = newGame(SIX, 2)
    const civilWords = new Set(
      game.players.value.filter(player => player.role === 'civil').map(player => player.word)
    )
    const undercoverWords = new Set(
      game.players.value.filter(player => player.role === 'undercover').map(player => player.word)
    )
    expect(civilWords.size).toBe(1)
    expect(undercoverWords.size).toBe(1)
    expect([...civilWords][0]).not.toBe([...undercoverWords][0])
  })

  it('distribue les deux mots de la paire fournie', () => {
    const game = newGame(SIX, 2)
    const words = new Set(game.players.value.map(player => player.word))
    expect(words).toEqual(new Set([PAIR.a, PAIR.b]))
  })

  it('n’attribue pas toujours le même côté de la paire aux civils', () => {
    const civilSides = [1, 2, 3, 4, 5, 6, 7, 8].map(
      seed =>
        newGame(SIX, 1, seed).players.value.find(player => player.role === 'civil')!.word
    )
    expect(new Set(civilSides).size).toBe(2)
  })

  it('ne place pas les undercovers toujours aux mêmes sièges', () => {
    const seatSets = [1, 2, 3, 4, 5, 6, 7, 8].map(seed =>
      newGame(SIX, 2, seed)
        .players.value.filter(player => player.role === 'undercover')
        .map(player => player.id)
        .join(',')
    )
    expect(new Set(seatSets).size).toBeGreaterThan(1)
  })
})

describe('createGame — distribution en pass-and-play', () => {
  it('fait défiler les agents un par un puis lance la première manche', () => {
    const game = newGame(SIX, 1)
    expect(game.currentRevealPlayer.value?.name).toBe('Marion')
    expect(game.isLastReveal.value).toBe(false)

    game.nextReveal()
    expect(game.currentRevealPlayer.value?.name).toBe('Karim')
    expect(game.phase.value).toBe('reveal')

    for (let i = 2; i < SIX.length; i++) game.nextReveal()
    expect(game.isLastReveal.value).toBe(true)
    expect(game.phase.value).toBe('reveal')

    game.nextReveal()
    expect(game.phase.value).toBe('describe')
    expect(game.round.value).toBe(1)
    expect(game.revealIndex.value).toBe(0)
  })

  it('ignore nextReveal en dehors de la phase reveal', () => {
    const game = newGame(SIX, 1)
    finishReveal(game)
    game.nextReveal()
    expect(game.phase.value).toBe('describe')
    expect(game.round.value).toBe(1)
  })
})

describe('createGame — tour de description', () => {
  it('fait parler chaque agent puis bascule sur le vote', () => {
    const game = newGame(SIX, 1)
    finishReveal(game)

    expect(game.speakingOrder.value).toHaveLength(6)
    expect(game.currentSpeaker.value?.name).toBe('Marion')

    for (let i = 0; i < SIX.length - 1; i++) game.nextSpeaker()
    expect(game.phase.value).toBe('describe')

    game.nextSpeaker()
    expect(game.phase.value).toBe('vote')
    expect(game.speakerIndex.value).toBe(0)
  })

  it('décale l’agent qui ouvre la manche suivante', () => {
    const game = newGame(SIX, 1)
    finishReveal(game)
    const firstSpeaker = game.currentSpeaker.value!

    playRoundAndEliminate(game, 'civil')

    expect(game.round.value).toBe(2)
    expect(game.currentSpeaker.value?.id).not.toBe(firstSpeaker.id)
  })

  it('sort les agents éliminés de l’ordre de parole', () => {
    const game = newGame(SIX, 1)
    finishReveal(game)
    const eliminated = playRoundAndEliminate(game, 'civil')

    expect(game.speakingOrder.value).toHaveLength(5)
    expect(game.speakingOrder.value.map(player => player.id)).not.toContain(eliminated.id)
  })
})

describe('createGame — vote et élimination', () => {
  it('marque la cible comme éliminée et la retient pour le débriefing', () => {
    const game = newGame(SIX, 1)
    finishReveal(game)
    finishDescription(game)

    const target = game.alivePlayers.value[2]!
    expect(game.eliminate(target.id)).toBe(true)
    expect(game.phase.value).toBe('elimination')
    expect(game.lastEliminated.value?.id).toBe(target.id)
    expect(game.players.value.find(player => player.id === target.id)?.alive).toBe(false)
    expect(game.alivePlayers.value).toHaveLength(5)
  })

  it('refuse une cible inconnue, déjà éliminée, ou hors phase de vote', () => {
    const game = newGame(SIX, 1)
    finishReveal(game)

    // Toujours en description : le vote n'est pas ouvert.
    expect(game.eliminate(game.players.value[0]!.id)).toBe(false)
    expect(game.phase.value).toBe('describe')

    finishDescription(game)
    expect(game.eliminate('agent-inconnu')).toBe(false)
    expect(game.phase.value).toBe('vote')

    const target = game.alivePlayers.value[0]!
    expect(game.eliminate(target.id)).toBe(true)
    expect(game.eliminate(target.id)).toBe(false)
  })
})

describe('createGame — conditions de victoire', () => {
  it('donne la victoire aux civils quand le dernier undercover tombe', () => {
    const game = newGame(['Marion', 'Karim', 'Sami'], 1)
    finishReveal(game)
    playRoundAndEliminate(game, 'undercover')

    expect(game.winner.value).toBe('civils')
    expect(game.phase.value).toBe('victory')
    expect(game.aliveUndercovers.value).toBe(0)
  })

  /** À égalité la partie tient encore : c'est la manche en tête-à-tête. */
  it('laisse la partie ouverte quand les camps s’égalisent', () => {
    // 5 agents / 2 undercovers : un civil éliminé fait 2 contre 2.
    const game = newGame(['Marion', 'Karim', 'Sami', 'Léa', 'Youssef'], 2)
    finishReveal(game)
    playRoundAndEliminate(game, 'civil')

    expect(game.aliveCivils.value).toBe(2)
    expect(game.aliveUndercovers.value).toBe(2)
    expect(game.winner.value).toBeNull()
    expect(game.phase.value).toBe('describe')
  })

  it('ne donne la victoire aux undercovers qu’en supériorité', () => {
    const game = newGame(['Marion', 'Karim', 'Sami', 'Léa', 'Youssef'], 2)
    finishReveal(game)
    playRoundAndEliminate(game, 'civil')
    playRoundAndEliminate(game, 'civil')

    expect(game.aliveCivils.value).toBe(1)
    expect(game.aliveUndercovers.value).toBe(2)
    expect(game.winner.value).toBe('undercovers')
    expect(game.phase.value).toBe('victory')
  })

  it('enchaîne sur une nouvelle manche tant que personne n’a gagné', () => {
    const game = newGame(SIX, 1)
    finishReveal(game)
    playRoundAndEliminate(game, 'civil')

    expect(game.winner.value).toBeNull()
    expect(game.phase.value).toBe('describe')
    expect(game.round.value).toBe(2)
    expect(game.speakerIndex.value).toBe(0)
  })

  it('ignore resolveElimination en dehors de la phase élimination', () => {
    const game = newGame(SIX, 1)
    finishReveal(game)
    game.resolveElimination()
    expect(game.phase.value).toBe('describe')
    expect(game.round.value).toBe(1)
  })
})

describe('createGame — fin de partie', () => {
  it('rejoue avec la même équipe en redistribuant les rôles', () => {
    const game = newGame(['Marion', 'Karim', 'Sami'], 1)
    finishReveal(game)
    playRoundAndEliminate(game, 'undercover')
    expect(game.phase.value).toBe('victory')

    const nextPair = { a: 'Avion', b: 'Hélicoptère' }
    game.replaySameTeam({ pair: nextPair })

    expect(game.phase.value).toBe('reveal')
    expect(game.players.value.map(player => player.name)).toEqual(['Marion', 'Karim', 'Sami'])
    // Nouvelle partie = nouvelle paire : les anciens mots ne doivent pas resservir.
    expect(new Set(game.players.value.map(player => player.word))).toEqual(
      new Set([nextPair.a, nextPair.b])
    )
    expect(game.players.value.every(player => player.alive)).toBe(true)
    expect(game.players.value.filter(player => player.role === 'undercover')).toHaveLength(1)
    expect(game.winner.value).toBeNull()
    expect(game.lastEliminated.value).toBeNull()
    expect(game.round.value).toBe(0)
  })

  it('repart d’une feuille blanche avec newGame', () => {
    const game = newGame(SIX, 2)
    finishReveal(game)
    finishDescription(game)
    game.eliminate(game.alivePlayers.value[0]!.id)

    game.newGame()

    expect(game.phase.value).toBe('setup')
    expect(game.players.value).toEqual([])
    expect(game.winner.value).toBeNull()
    expect(game.lastEliminated.value).toBeNull()
    expect(game.error.value).toBeNull()
  })
})

describe('createGame — modes de jeu', () => {
  it('retient le mode choisi', () => {
    expect(gameInMode({ mode: 'hot' }).mode.value).toBe('hot')
  })

  describe('chrono', () => {
    it('signale une partie minutée et retient la durée', () => {
      const game = gameInMode({ mode: 'chrono', timerSeconds: 45 })

      expect(game.isTimed.value).toBe(true)
      expect(game.timerSeconds.value).toBe(45)
    })

    it('retombe sur la durée par défaut si aucune n’est donnée', () => {
      expect(gameInMode({ mode: 'chrono' }).timerSeconds.value).toBe(DEFAULT_TIMER_SECONDS)
    })

    it('ne minute pas les autres modes', () => {
      expect(gameInMode({ mode: 'classique' }).isTimed.value).toBe(false)
    })
  })

  describe('défi', () => {
    it('porte le défi de la partie', () => {
      const game = gameInMode({ mode: 'defi' }, 'Utilise une couleur')

      expect(game.challenge.value).toBe('Utilise une couleur')
    })

    it('remplace le défi en rejouant', () => {
      const game = gameInMode({ mode: 'defi' }, 'Utilise une couleur')

      game.replaySameTeam({ pair: { a: 'Avion', b: 'Train' }, challenge: 'Parle au passé' })

      expect(game.challenge.value).toBe('Parle au passé')
    })

    it('oublie le défi en repartant de zéro', () => {
      const game = gameInMode({ mode: 'defi' }, 'Utilise une couleur')

      game.newGame()

      expect(game.challenge.value).toBeNull()
    })
  })

  describe('pari risqué', () => {
    /** Amène la partie jusqu'à la phase de paris. */
    function upToBets(): Game {
      const game = gameInMode({ mode: 'pari' })
      finishReveal(game)
      finishDescription(game)
      return game
    }

    /** Un pari valide pour chaque agent vivant : chacun vise son voisin. */
    function everyoneBets(game: Game, stake = 5) {
      const alive = game.alivePlayers.value
      return alive.map((player, index) => ({
        playerId: player.id,
        targetId: alive[(index + 1) % alive.length]!.id,
        stake
      }))
    }

    it('insère la phase de paris entre la description et le vote', () => {
      expect(upToBets().phase.value).toBe('bets')
    })

    it('ouvre le vote une fois les mises enregistrées', () => {
      const game = upToBets()

      expect(game.placeBets(everyoneBets(game))).toBe(true)
      expect(game.phase.value).toBe('vote')
      expect(game.bets.value).toHaveLength(SIX.length)
    })

    it('ne repasse pas par les paris aux manches suivantes', () => {
      const game = upToBets()
      game.placeBets(everyoneBets(game))
      eliminateOne(game, 'civil')
      expect(game.phase.value).toBe('describe')

      finishDescription(game)

      expect(game.phase.value).toBe('vote')
    })

    it('refuse une mise sur soi-même', () => {
      const game = upToBets()
      const alive = game.alivePlayers.value
      const bets = everyoneBets(game)
      bets[0] = { playerId: alive[0]!.id, targetId: alive[0]!.id, stake: 5 }

      expect(game.placeBets(bets)).toBe(false)
      expect(game.error.value).toContain('soi-même')
      expect(game.phase.value).toBe('bets')
    })

    it('refuse une mise négative', () => {
      const game = upToBets()
      const bets = everyoneBets(game)
      bets[0]!.stake = -1

      expect(game.placeBets(bets)).toBe(false)
      expect(game.error.value).toContain('négative')
    })

    it('exige que toute la table ait misé', () => {
      const game = upToBets()

      expect(game.placeBets(everyoneBets(game).slice(1))).toBe(false)
      expect(game.error.value).toContain('Tout le monde')
    })

    it('refuse deux mises du même agent', () => {
      const game = upToBets()
      const bets = everyoneBets(game)
      bets[1]!.playerId = bets[0]!.playerId

      expect(game.placeBets(bets)).toBe(false)
      expect(game.error.value).toContain('qu’une fois')
    })

    it('ne règle les comptes qu’à la victoire', () => {
      const game = upToBets()
      game.placeBets(everyoneBets(game))

      expect(game.settlement.value).toEqual([])
    })

    it('règle les comptes à la révélation des rôles', () => {
      const game = upToBets()
      const undercover = game.players.value.find(player => player.role === 'undercover')!
      const bets = everyoneBets(game).map(bet => ({ ...bet, targetId: undercover.id }))
      // Le suspect ne peut pas miser sur lui-même : il vise quelqu'un d'autre.
      bets.find(bet => bet.playerId === undercover.id)!.targetId
        = game.alivePlayers.value.find(player => player.id !== undercover.id)!.id
      game.placeBets(bets)

      game.eliminate(undercover.id)
      game.resolveElimination()
      expect(game.phase.value).toBe('victory')

      const settlement = game.settlement.value
      expect(settlement).toHaveLength(SIX.length)
      // Cinq civils ont vu juste, l'undercover perd sa mise de 5.
      expect(settlement.filter(row => row.won)).toHaveLength(SIX.length - 1)
      expect(settlement.find(row => row.playerId === undercover.id)?.net).toBe(-5)
      expect(Math.round(settlement.reduce((sum, row) => sum + row.net, 0) * 100)).toBe(0)
    })

    it('oublie les mises en rejouant', () => {
      const game = upToBets()
      game.placeBets(everyoneBets(game))

      game.replaySameTeam({ pair: { a: 'Avion', b: 'Train' } })

      expect(game.bets.value).toEqual([])
      expect(game.needsBets.value).toBe(true)
    })
  })

  it('ne demande pas de paris hors du mode pari', () => {
    const game = gameInMode({ mode: 'classique' })
    finishReveal(game)

    finishDescription(game)

    expect(game.phase.value).toBe('vote')
    expect(game.needsBets.value).toBe(false)
  })
})
