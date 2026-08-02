import { computed, ref } from 'vue'

/**
 * Deux mots proches mais distincts : les civils reçoivent l'un, les
 * undercovers l'autre. Les paires viennent de l'API (lot quotidien généré
 * par LLM) — il n'y a plus de liste locale.
 */
export interface WordPair {
  a: string
  b: string
}

export type Role = 'civil' | 'undercover'
export type Phase = 'setup' | 'reveal' | 'describe' | 'vote' | 'elimination' | 'victory'
export type Winner = 'civils' | 'undercovers' | null

export interface Player {
  id: string
  name: string
  role: Role
  word: string
  alive: boolean
}

export interface GameConfig {
  names: string[]
  undercoverCount: number
}

export const MIN_PLAYERS = 3
export const MAX_PLAYERS = 12

/**
 * Les civils doivent être strictement majoritaires au lancement : à parité la
 * condition de victoire des undercovers serait déjà remplie et la partie
 * s'arrêterait avant le premier tour.
 */
export function maxUndercovers(playerCount: number): number {
  return Math.floor((playerCount - 1) / 2)
}

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const swap = out[i]!
    out[i] = out[j]!
    out[j] = swap
  }
  return out
}

function deal(names: string[], undercoverCount: number, pair: WordPair, rng: () => number): Player[] {
  // Le côté de la paire attribué aux civils est tiré au sort, sinon les
  // undercovers hériteraient toujours du même mot de la liste.
  const civilsTakeA = rng() < 0.5
  const civilWord = civilsTakeA ? pair.a : pair.b
  const undercoverWord = civilsTakeA ? pair.b : pair.a

  const roles = shuffle(
    names.map<Role>((_, i) => (i < undercoverCount ? 'undercover' : 'civil')),
    rng
  )

  return names.map((name, i) => {
    const role = roles[i]!
    return {
      id: `agent-${i}`,
      name,
      role,
      word: role === 'undercover' ? undercoverWord : civilWord,
      alive: true
    }
  })
}

function validate(names: string[], undercoverCount: number): string | null {
  if (names.length < MIN_PLAYERS || names.length > MAX_PLAYERS) {
    return `Il faut entre ${MIN_PLAYERS} et ${MAX_PLAYERS} agents sur le terrain.`
  }
  if (names.some(name => name.length === 0)) {
    return 'Chaque agent a besoin d’un nom de code.'
  }
  const seen = new Set(names.map(name => name.toLocaleLowerCase()))
  if (seen.size !== names.length) {
    return 'Deux agents ne peuvent pas partager le même nom de code.'
  }
  const ceiling = maxUndercovers(names.length)
  if (undercoverCount < 1 || undercoverCount > ceiling) {
    return `Pour ${names.length} agents, il faut entre 1 et ${ceiling} undercover${ceiling > 1 ? 's' : ''}.`
  }
  return null
}

/**
 * Machine à états d'une partie locale en pass-and-play.
 *
 * Factory plutôt que singleton de module : chaque appel repart d'un état neuf,
 * ce qui rend les tests indépendants et permet d'injecter un `rng` déterministe.
 */
export function createGame(options: { rng?: () => number } = {}) {
  const rng = options.rng ?? Math.random

  const phase = ref<Phase>('setup')
  const players = ref<Player[]>([])
  const round = ref(0)
  const revealIndex = ref(0)
  const speakerIndex = ref(0)
  const lastEliminated = ref<Player | null>(null)
  const winner = ref<Winner>(null)
  const error = ref<string | null>(null)

  const names = ref<string[]>([])
  const undercoverCount = ref(1)

  const alivePlayers = computed(() => players.value.filter(player => player.alive))
  const aliveUndercovers = computed(
    () => alivePlayers.value.filter(player => player.role === 'undercover').length
  )
  const aliveCivils = computed(
    () => alivePlayers.value.filter(player => player.role === 'civil').length
  )

  const currentRevealPlayer = computed<Player | null>(
    () => players.value[revealIndex.value] ?? null
  )
  const isLastReveal = computed(() => revealIndex.value === players.value.length - 1)

  // L'ordre de parole tourne d'une manche à l'autre pour que le même agent ne
  // commence jamais deux fois de suite.
  const speakingOrder = computed<Player[]>(() => {
    const alive = alivePlayers.value
    if (alive.length === 0) return []
    const offset = (Math.max(round.value, 1) - 1) % alive.length
    return [...alive.slice(offset), ...alive.slice(0, offset)]
  })
  const currentSpeaker = computed<Player | null>(() => speakingOrder.value[speakerIndex.value] ?? null)

  function startRound(next: number) {
    round.value = next
    speakerIndex.value = 0
    phase.value = 'describe'
  }

  /**
   * La paire du jour est fournie par l'appelant (crédit quotidien) : elle
   * n'est consommée que si la configuration est valide — un `false` ne doit
   * pas brûler de crédit.
   */
  function configure(config: GameConfig, pair: WordPair): boolean {
    const trimmed = config.names.map(name => name.trim())
    const problem = validate(trimmed, config.undercoverCount)
    error.value = problem
    if (problem) return false

    names.value = trimmed
    undercoverCount.value = config.undercoverCount
    players.value = deal(trimmed, config.undercoverCount, pair, rng)
    revealIndex.value = 0
    speakerIndex.value = 0
    round.value = 0
    lastEliminated.value = null
    winner.value = null
    phase.value = 'reveal'
    return true
  }

  function nextReveal() {
    if (phase.value !== 'reveal') return
    if (revealIndex.value < players.value.length - 1) {
      revealIndex.value += 1
      return
    }
    revealIndex.value = 0
    startRound(1)
  }

  function nextSpeaker() {
    if (phase.value !== 'describe') return
    if (speakerIndex.value < speakingOrder.value.length - 1) {
      speakerIndex.value += 1
      return
    }
    speakerIndex.value = 0
    phase.value = 'vote'
  }

  function eliminate(playerId: string): boolean {
    if (phase.value !== 'vote') return false
    const target = players.value.find(player => player.id === playerId && player.alive)
    if (!target) return false
    target.alive = false
    lastEliminated.value = target
    phase.value = 'elimination'
    return true
  }

  function resolveElimination() {
    if (phase.value !== 'elimination') return
    if (aliveUndercovers.value === 0) {
      winner.value = 'civils'
      phase.value = 'victory'
      return
    }
    if (aliveUndercovers.value >= aliveCivils.value) {
      winner.value = 'undercovers'
      phase.value = 'victory'
      return
    }
    startRound(round.value + 1)
  }

  // Rejouer est une nouvelle partie : elle consomme un crédit, donc une
  // nouvelle paire — sinon l'équipe rejouerait avec des mots déjà connus.
  function replaySameTeam(pair: WordPair) {
    players.value = deal(names.value, undercoverCount.value, pair, rng)
    revealIndex.value = 0
    speakerIndex.value = 0
    round.value = 0
    lastEliminated.value = null
    winner.value = null
    phase.value = 'reveal'
  }

  function newGame() {
    players.value = []
    revealIndex.value = 0
    speakerIndex.value = 0
    round.value = 0
    lastEliminated.value = null
    winner.value = null
    error.value = null
    phase.value = 'setup'
  }

  return {
    // état
    phase,
    players,
    round,
    revealIndex,
    speakerIndex,
    lastEliminated,
    winner,
    error,
    names,
    undercoverCount,
    // dérivés
    alivePlayers,
    aliveUndercovers,
    aliveCivils,
    currentRevealPlayer,
    isLastReveal,
    speakingOrder,
    currentSpeaker,
    // actions
    configure,
    nextReveal,
    nextSpeaker,
    eliminate,
    resolveElimination,
    replaySameTeam,
    newGame
  }
}

export type Game = ReturnType<typeof createGame>
