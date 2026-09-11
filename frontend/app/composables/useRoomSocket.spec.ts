import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoomSocket, type RoomState } from './useRoomSocket'

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body)
  } as Response
}

const JOIN_RESULT = {
  code: 'ABC234',
  roomId: 'room-1',
  playerId: 'player-1',
  playerToken: 'secret-token',
  displayName: 'Hôte',
  isHost: true
}

class FakeSocket {
  listeners = new Map<string, Set<(payload?: unknown) => void>>()
  emit = vi.fn()
  disconnect = vi.fn()

  on(event: string, handler: (payload?: unknown) => void): this {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    this.listeners.get(event)!.add(handler)
    return this
  }

  trigger(event: string, payload?: unknown): void {
    for (const handler of this.listeners.get(event) ?? []) handler(payload)
  }
}

describe('createRoomSocket', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('createRoom / joinRoom (REST)', () => {
    it('crée une salle et retient le jeton de siège pour ce code', async () => {
      const request = vi.fn().mockResolvedValue(jsonResponse(JOIN_RESULT, 201))
      const room = createRoomSocket({ apiBase: 'http://api.test', request })

      const result = await room.createRoom('Hôte', 'general', true, 'farfelu')

      expect(request).toHaveBeenCalledWith('/rooms', {
        method: 'POST',
        body: JSON.stringify({ displayName: 'Hôte', theme: 'general', spicy: true, difficulty: 'farfelu' })
      })
      expect(result?.code).toBe('ABC234')
      expect(localStorage.getItem('undercover:room:ABC234')).toContain('secret-token')
    })

    it('rejoint une salle existante via son code', async () => {
      const request = vi.fn().mockResolvedValue(
        jsonResponse({ ...JOIN_RESULT, isHost: false, playerId: 'player-2' }, 201)
      )
      const room = createRoomSocket({ apiBase: 'http://api.test', request })

      const result = await room.joinRoom('abc234', 'Agent 2')

      expect(request).toHaveBeenCalledWith('/rooms/ABC234/join', {
        method: 'POST',
        body: JSON.stringify({ displayName: 'Agent 2' })
      })
      expect(result?.isHost).toBe(false)
    })

    it('rend null et remonte le message sur un échec HTTP', async () => {
      const request = vi.fn().mockResolvedValue(jsonResponse({ message: 'Salle introuvable.' }, 404))
      const room = createRoomSocket({ apiBase: 'http://api.test', request })

      const result = await room.joinRoom('ZZZZZZ', 'Agent 2')

      expect(result).toBeNull()
      expect(room.error.value).toBe('Salle introuvable.')
    })
  })

  describe('connect', () => {
    it('refuse de se connecter sans jeton connu pour ce code', () => {
      const ioFactory = vi.fn()
      const room = createRoomSocket({
        apiBase: 'http://api.test',
        request: vi.fn(),
        ioFactory: ioFactory as never
      })

      room.connect('NOPE00')

      expect(ioFactory).not.toHaveBeenCalled()
      expect(room.status.value).toBe('error')
    })

    it('se connecte avec le jeton explicite reçu de create/join', () => {
      const socket = new FakeSocket()
      const ioFactory = vi.fn().mockReturnValue(socket)
      const room = createRoomSocket({
        apiBase: 'http://api.test',
        request: vi.fn(),
        ioFactory: ioFactory as never
      })

      room.connect('ABC234', 'secret-token')

      expect(ioFactory).toHaveBeenCalledWith('http://api.test/rooms', {
        auth: { token: 'secret-token' },
        transports: ['websocket']
      })
    })

    it('se reconnecte avec le jeton retenu en localStorage après un create', async () => {
      const request = vi.fn().mockResolvedValue(jsonResponse(JOIN_RESULT, 201))
      const socket = new FakeSocket()
      const ioFactory = vi.fn().mockReturnValue(socket)
      const room = createRoomSocket({ apiBase: 'http://api.test', request, ioFactory: ioFactory as never })

      await room.createRoom('Hôte')
      room.connect('ABC234')

      expect(ioFactory).toHaveBeenCalledWith(
        'http://api.test/rooms',
        expect.objectContaining({ auth: { token: 'secret-token' } })
      )
    })

    it('met à jour state à chaque room:state reçu', () => {
      const socket = new FakeSocket()
      const room = createRoomSocket({
        apiBase: 'http://api.test',
        request: vi.fn(),
        ioFactory: vi.fn().mockReturnValue(socket) as never
      })
      room.connect('ABC234', 'secret-token')

      const payload = { phase: 'lobby', players: [] } as unknown as RoomState
      socket.trigger('room:state', payload)

      // `toStrictEqual`, pas `toBe` : `ref()` enveloppe un objet dans un proxy
      // réactif, la valeur lue n'est donc plus la même référence que `payload`.
      expect(room.state.value).toStrictEqual(payload)
      expect(room.status.value).toBe('connected')
    })

    it('remonte room:error sans faire planter la socket', () => {
      const socket = new FakeSocket()
      const room = createRoomSocket({
        apiBase: 'http://api.test',
        request: vi.fn(),
        ioFactory: vi.fn().mockReturnValue(socket) as never
      })
      room.connect('ABC234', 'secret-token')

      socket.trigger('room:error', { message: 'Jeton de salle invalide.' })

      expect(room.error.value).toBe('Jeton de salle invalide.')
      expect(room.status.value).toBe('error')
    })

    it('garde le dernier événement de vote (égalité puis résolution)', () => {
      const socket = new FakeSocket()
      const room = createRoomSocket({
        apiBase: 'http://api.test',
        request: vi.fn(),
        ioFactory: vi.fn().mockReturnValue(socket) as never
      })
      room.connect('ABC234', 'secret-token')

      socket.trigger('vote:tie', { tiedPlayerIds: ['p1', 'p2'] })
      expect(room.lastVoteEvent.value).toEqual({ type: 'tie', tiedPlayerIds: ['p1', 'p2'] })

      socket.trigger('vote:resolved', { eliminatedPlayerId: 'p1', wasRandomTiebreak: false })
      expect(room.lastVoteEvent.value).toEqual({
        type: 'resolved',
        eliminatedPlayerId: 'p1',
        wasRandomTiebreak: false
      })
    })
  })

  describe('émetteurs d’action', () => {
    function connected() {
      const socket = new FakeSocket()
      const room = createRoomSocket({
        apiBase: 'http://api.test',
        request: vi.fn(),
        ioFactory: vi.fn().mockReturnValue(socket) as never
      })
      room.connect('ABC234', 'secret-token')
      return { room, socket }
    }

    it('start émet room:start', () => {
      const { room, socket } = connected()
      room.start()
      expect(socket.emit).toHaveBeenCalledWith('room:start', {})
    })

    it('castVote émet vote:cast avec la cible', () => {
      const { room, socket } = connected()
      room.castVote('target-1')
      expect(socket.emit).toHaveBeenCalledWith('vote:cast', { targetPlayerId: 'target-1' })
    })

    it('configureRoom émet room:configure avec le correctif fourni', () => {
      const { room, socket } = connected()
      room.configureRoom({ undercoverCount: 2 })
      expect(socket.emit).toHaveBeenCalledWith('room:configure', { undercoverCount: 2 })
    })

    it('leaveRoom émet room:leave', () => {
      const { room, socket } = connected()
      room.leaveRoom()
      expect(socket.emit).toHaveBeenCalledWith('room:leave', {})
    })

    it('disconnect ferme la socket et rend les émissions suivantes silencieuses', () => {
      const { room, socket } = connected()
      room.disconnect()
      expect(socket.disconnect).toHaveBeenCalled()

      // Pas de socket active : émettre ne doit rien lever.
      expect(() => room.castVote('target-1')).not.toThrow()
    })
  })
})
