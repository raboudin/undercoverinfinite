import { ref, shallowRef } from 'vue'
import { io as ioClient, type Socket } from 'socket.io-client'
import type { DifficultyId, ThemeId } from './useEntitlements'

export type Role = 'civil' | 'undercover'

/** Vue rédigée d'un joueur : `role`/`word` sont nuls tant que le serveur ne les révèle pas à CE spectateur. */
export interface OnlinePlayer {
  id: string
  displayName: string
  isHost: boolean
  seat: number | null
  alive: boolean
  hasSeenReveal: boolean
  connected: boolean
  role: Role | null
  word: string | null
}

export type RoomPhase
  = 'lobby' | 'reveal' | 'describe' | 'vote' | 'elimination' | 'victory'

export interface RoomVoteRow {
  voterId: string
  targetId: string
}

/** Reflet intégral du dernier `room:state` reçu — on remplace, on ne diffe pas, comme côté serveur. */
export interface RoomState {
  roomId: string
  code: string
  phase: RoomPhase
  theme: ThemeId
  spicy: boolean
  difficulty: DifficultyId
  undercoverCount: number | null
  round: number
  attempt: number
  speakerIndex: number
  speakingOrder: string[]
  lastEliminatedPlayerId: string | null
  winner: 'civils' | 'undercovers' | null
  dealNumber: number
  viewerPlayerId: string
  isHost: boolean
  players: OnlinePlayer[]
  /** Public par choix produit : chaque vote est visible en direct, identité comprise. */
  votes: RoomVoteRow[]
}

export interface RoomJoinResult {
  code: string
  roomId: string
  playerId: string
  playerToken: string
  displayName: string
  isHost: boolean
}

export type RoomSocketStatus = 'idle' | 'connecting' | 'connected' | 'error'

export type VoteEvent
  = { type: 'tie', tiedPlayerIds: string[] }
    | { type: 'resolved', eliminatedPlayerId: string, wasRandomTiebreak: boolean }

const GENERIC_ERROR = 'Le QG ne répond pas. Réessaie dans un instant.'
const STORAGE_PREFIX = 'undercover:room:'

interface StoredMembership {
  playerId: string
  playerToken: string
}

function storageKey(code: string): string {
  return `${STORAGE_PREFIX}${code.toUpperCase()}`
}

/** Le jeton de siège vit en `localStorage`, pas en cookie httpOnly : c'est le
 * socket qui le lit depuis le payload `auth` du handshake, pas une route
 * Express — et il identifie un SIÈGE dans UNE salle, pas un appareil. */
function readMembership(code: string): StoredMembership | null {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(storageKey(code))
    return raw ? (JSON.parse(raw) as StoredMembership) : null
  }
  catch {
    return null
  }
}

function writeMembership(code: string, membership: StoredMembership): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(storageKey(code), JSON.stringify(membership))
}

/**
 * Salle en ligne : REST pour créer/rejoindre (le cookie `device_id` d'un hôte
 * ou d'un invité anonyme ne peut être posé que sur une vraie réponse HTTP —
 * impossible dans un handshake Socket.IO), puis Socket.IO pour tout le reste
 * une fois dans la salle — un seul transport autoritaire pour l'état vivant.
 *
 * Composable instancié **localement dans la page** (`pages/salle/[code].vue`),
 * pas via un plugin `$…` : une socket est scopée à une salle et doit se
 * fermer en quittant la route, contrairement à `$auth`/`$entitlements` qui
 * couvrent toute la session (voir leurs commentaires sur la fuite d'un `ref`
 * de module entre requêtes SSR — même raison, mais dans l'autre sens ici).
 *
 * `request` est injecté comme pour `createWords`/`createEntitlements` — la
 * page lui passe `$auth.authFetch`, qui rejoue une requête après rotation du
 * token. `ioFactory` est un point d'injection pour les tests.
 */
export function createRoomSocket(options: {
  apiBase: string
  request: (path: string, init?: RequestInit) => Promise<Response>
  ioFactory?: typeof ioClient
}) {
  const connectSocket = options.ioFactory ?? ioClient

  const status = ref<RoomSocketStatus>('idle')
  const error = ref<string | null>(null)
  const state = ref<RoomState | null>(null)
  const lastVoteEvent = ref<VoteEvent | null>(null)

  const socket = shallowRef<Socket | null>(null)

  async function messageOf(response: Response): Promise<string> {
    try {
      const body = (await response.json()) as { message?: string | string[] }
      const message = Array.isArray(body.message) ? body.message[0] : body.message
      return message ?? GENERIC_ERROR
    }
    catch {
      return GENERIC_ERROR
    }
  }

  async function createRoom(
    displayName: string,
    theme?: ThemeId,
    spicy?: boolean,
    difficulty?: DifficultyId
  ): Promise<RoomJoinResult | null> {
    error.value = null
    try {
      const response = await options.request('/rooms', {
        method: 'POST',
        body: JSON.stringify({ displayName, theme, spicy, difficulty })
      })
      if (!response.ok) {
        error.value = await messageOf(response)
        return null
      }
      const result = (await response.json()) as RoomJoinResult
      writeMembership(result.code, { playerId: result.playerId, playerToken: result.playerToken })
      return result
    }
    catch {
      error.value = GENERIC_ERROR
      return null
    }
  }

  async function joinRoom(code: string, displayName: string): Promise<RoomJoinResult | null> {
    error.value = null
    try {
      const response = await options.request(`/rooms/${code.toUpperCase()}/join`, {
        method: 'POST',
        body: JSON.stringify({ displayName })
      })
      if (!response.ok) {
        error.value = await messageOf(response)
        return null
      }
      const result = (await response.json()) as RoomJoinResult
      writeMembership(result.code, { playerId: result.playerId, playerToken: result.playerToken })
      return result
    }
    catch {
      error.value = GENERIC_ERROR
      return null
    }
  }

  /**
   * Ouvre la socket. `playerToken` explicite juste après `create`/`join` (pas
   * encore relu depuis le stockage) ; sinon on retombe sur le jeton conservé
   * pour ce code, ce qui permet de revenir sur la salle après un rafraîchissement.
   */
  function connect(code: string, playerToken?: string): void {
    const token = playerToken ?? readMembership(code)?.playerToken
    if (!token) {
      error.value = 'Aucun accès enregistré pour cette salle sur cet appareil.'
      status.value = 'error'
      return
    }

    disconnect()
    status.value = 'connecting'
    error.value = null

    const next = connectSocket(`${options.apiBase}/rooms`, {
      auth: { token },
      transports: ['websocket']
    })

    next.on('connect', () => {
      status.value = 'connected'
    })
    next.on('room:state', (payload: RoomState) => {
      state.value = payload
      status.value = 'connected'
    })
    next.on('room:error', (payload: { message: string }) => {
      error.value = payload.message
      status.value = 'error'
    })
    next.on('vote:tie', (payload: { tiedPlayerIds: string[] }) => {
      lastVoteEvent.value = { type: 'tie', tiedPlayerIds: payload.tiedPlayerIds }
    })
    next.on('vote:resolved', (payload: { eliminatedPlayerId: string, wasRandomTiebreak: boolean }) => {
      lastVoteEvent.value = { type: 'resolved', ...payload }
    })
    next.on('disconnect', () => {
      if (status.value !== 'error') status.value = 'idle'
    })

    socket.value = next
  }

  function disconnect(): void {
    socket.value?.disconnect()
    socket.value = null
  }

  function emit(event: string, payload?: unknown): void {
    socket.value?.emit(event, payload ?? {})
  }

  function configureRoom(patch: {
    theme?: ThemeId
    spicy?: boolean
    difficulty?: DifficultyId
    undercoverCount?: number
  }): void {
    emit('room:configure', patch)
  }

  function start(): void {
    emit('room:start')
  }

  function ackReveal(): void {
    emit('reveal:ack')
  }

  function nextSpeaker(): void {
    emit('describe:next')
  }

  function castVote(targetPlayerId: string): void {
    emit('vote:cast', { targetPlayerId })
  }

  function continueAfterElimination(): void {
    emit('elimination:continue')
  }

  function replay(): void {
    emit('game:replay')
  }

  function leaveRoom(): void {
    emit('room:leave')
  }

  return {
    status,
    error,
    state,
    lastVoteEvent,
    createRoom,
    joinRoom,
    connect,
    disconnect,
    configureRoom,
    start,
    ackReveal,
    nextSpeaker,
    castVote,
    continueAfterElimination,
    replay,
    leaveRoom
  }
}

export type RoomSocket = ReturnType<typeof createRoomSocket>
