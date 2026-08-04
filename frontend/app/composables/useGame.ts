import { computed, ref } from 'vue'
import { settleStakes, type Bet, type Settlement } from './useBets'
import type { ModeId } from './useEntitlements'

/**
 * Deux mots proches mais distincts : les civils reçoivent l'un, les
 * undercovers l'autre. La paire vient de l'API, tirée à la demande pour cette
 * partie — il n'y a pas de liste locale.
 */
export interface WordPair {
  a: string
  b: string
}

export type Role = 'civil' | 'undercover'
export type Phase
  = 'setup' | 'reveal' | 'describe' | 'bets' | 'vote' | 'elimination' | 'victory'
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
  mode: ModeId
  /** Secondes par prise de parole. Mode chrono uniquement. */
  timerSeconds?: number
}

/**
 * Ce que le serveur a préparé pour cette partie. `configure` le reçoit plutôt
 * que d'aller le chercher : le moteur ne connaît ni l'API ni les crédits, ce
 * qui le laisse testable sans réseau.
 */
export interface GameSetup {
  pair: WordPair
  /** Mode défi uniquement : la contrainte tenue par toute la table. */
  challenge?: string | null
}

export const MIN_PLAYERS = 3
export const MAX_PLAYERS = 12

/** Durée par défaut d'une prise de parole en mode chrono. */
export const DEFAULT_TIMER_SECONDS = 30
export const MIN_TIMER_SECONDS = 10
export const MAX_TIMER_SECONDS = 120

/**
 * Les civils restent strictement majoritaires au lancement. Ce n'est plus une
 * question de règle — à parité la partie tiendrait encore, puisque les
 * undercovers ne gagnent qu'en étant *plus nombreux* — mais d'intérêt : une
 * table qui démarre à égalité se joue sur une seule élimination.
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

/**
 * Un pari doit désigner un vivant autre que soi : miser sur soi-même ferait
 * de l'undercover un gagnant automatique, et le mode n'aurait plus de risque.
 */
function validateBets(bets: Bet[], alive: Player[]): string | null {
  const ids = new Set(alive.map(player => player.id))

  for (const bet of bets) {
    if (!ids.has(bet.playerId) || !ids.has(bet.targetId)) {
      return 'Chaque pari doit venir d’un agent encore en poste et viser un agent encore en poste.'
    }
    if (bet.playerId === bet.targetId) {
      return 'On ne mise pas sur soi-même.'
    }
    if (!Number.isFinite(bet.stake) || bet.stake < 0) {
      return 'Une mise ne peut pas être négative.'
    }
  }

  if (new Set(bets.map(bet => bet.playerId)).size !== bets.length) {
    return 'Un agent ne mise qu’une fois.'
  }
  if (bets.length !== alive.length) {
    return 'Tout le monde doit miser avant l’ouverture du vote.'
  }
  return null
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
  const mode = ref<ModeId>('classique')
  const timerSeconds = ref(DEFAULT_TIMER_SECONDS)
  const challenge = ref<string | null>(null)
  const bets = ref<Bet[]>([])

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

  /** Mode chrono : la seule différence est que la parole est minutée. */
  const isTimed = computed(() => mode.value === 'chrono')

  /**
   * Les paris se placent une fois par partie, juste après la première manche
   * de description : plus tôt, personne n'a d'indice ; à chaque manche, la
   * table repasserait son temps à saisir des chiffres.
   */
  const needsBets = computed(() => mode.value === 'pari' && bets.value.length === 0)

  /** Répartition des mises, calculée à la révélation des rôles. */
  const settlement = computed<Settlement[]>(() => {
    if (phase.value !== 'victory' || bets.value.length === 0) return []
    const undercovers = new Set(
      players.value.filter(player => player.role === 'undercover').map(player => player.id)
    )
    return settleStakes(bets.value, id => undercovers.has(id))
  })

  function startRound(next: number) {
    round.value = next
    speakerIndex.value = 0
    phase.value = 'describe'
  }

  /** Remet à zéro tout ce qui appartient à une partie et pas à l'équipe. */
  function resetRound() {
    revealIndex.value = 0
    speakerIndex.value = 0
    round.value = 0
    lastEliminated.value = null
    winner.value = null
    bets.value = []
  }

  /**
   * Les mots viennent de l'appelant, qui les a obtenus du serveur contre un
   * crédit. `configure` ne rend `true` que si la configuration tient : c'est ce
   * qui permet d'appeler l'API **avant** et de ne rien perdre si le formulaire
   * était invalide.
   */
  function configure(config: GameConfig, setup: GameSetup): boolean {
    const trimmed = config.names.map(name => name.trim())
    const problem = validate(trimmed, config.undercoverCount)
    error.value = problem
    if (problem) return false

    names.value = trimmed
    undercoverCount.value = config.undercoverCount
    mode.value = config.mode
    timerSeconds.value = config.timerSeconds ?? DEFAULT_TIMER_SECONDS
    challenge.value = setup.challenge ?? null
    players.value = deal(trimmed, config.undercoverCount, setup.pair, rng)
    resetRound()
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
    phase.value = needsBets.value ? 'bets' : 'vote'
  }

  /**
   * Enregistre les mises et ouvre le vote. L'app ne fait que tenir les
   * comptes : aucun paiement ne transite par elle, le règlement se fait entre
   * joueurs à la fin.
   */
  function placeBets(next: Bet[]): boolean {
    if (phase.value !== 'bets') return false
    const problem = validateBets(next, alivePlayers.value)
    error.value = problem
    if (problem) return false

    bets.value = next
    phase.value = 'vote'
    return true
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

  /**
   * Deux fins possibles, et deux seulement : plus aucun undercover en vie, ou
   * des undercovers **strictement plus nombreux** que les loyaux. À égalité la
   * partie continue — c'est ce qui laisse une dernière manche en tête-à-tête.
   */
  function resolveElimination() {
    if (phase.value !== 'elimination') return
    if (aliveUndercovers.value === 0) {
      winner.value = 'civils'
      phase.value = 'victory'
      return
    }
    if (aliveUndercovers.value > aliveCivils.value) {
      winner.value = 'undercovers'
      phase.value = 'victory'
      return
    }
    startRound(round.value + 1)
  }

  // Rejouer est une nouvelle partie : elle consomme un crédit, donc de
  // nouveaux mots — sinon l'équipe rejouerait avec une paire déjà connue.
  // Le mode et la durée de parole, eux, sont ceux de l'équipe : ils restent.
  function replaySameTeam(setup: GameSetup) {
    challenge.value = setup.challenge ?? null
    players.value = deal(names.value, undercoverCount.value, setup.pair, rng)
    resetRound()
    phase.value = 'reveal'
  }

  function newGame() {
    players.value = []
    challenge.value = null
    error.value = null
    resetRound()
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
    mode,
    timerSeconds,
    challenge,
    bets,
    // dérivés
    alivePlayers,
    aliveUndercovers,
    aliveCivils,
    currentRevealPlayer,
    isLastReveal,
    speakingOrder,
    currentSpeaker,
    isTimed,
    needsBets,
    settlement,
    // actions
    configure,
    nextReveal,
    nextSpeaker,
    placeBets,
    eliminate,
    resolveElimination,
    replaySameTeam,
    newGame
  }
}

export type Game = ReturnType<typeof createGame>
