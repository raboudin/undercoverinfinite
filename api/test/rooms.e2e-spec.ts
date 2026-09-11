import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { io, type Socket as ClientSocket } from 'socket.io-client';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { PrismaService } from './../src/prisma/prisma.service';

/**
 * Boucle complète d'une partie en ligne, avec quatre sockets réels. C'est le
 * seul niveau qui vérifie qu'un socket ne reçoit JAMAIS le rôle/mot d'un
 * autre joueur avant élimination ou victoire — `redaction.spec.ts` teste la
 * fonction pure, pas que le gateway l'appelle bien à chaque diffusion.
 *
 * Prérequis : `docker compose up -d postgres`, un `DATABASE_URL` valide, et
 * (puisque `room:start` débite un vrai tirage de mots) une config LLM
 * fonctionnelle dans `api/.env` — comme pour tout `npm run test:e2e` manuel.
 */
jest.setTimeout(30000);

interface RoomJoinResponse {
  code: string;
  roomId: string;
  playerId: string;
  playerToken: string;
  displayName: string;
  isHost: boolean;
}

interface RedactedPlayer {
  id: string;
  displayName: string;
  alive: boolean;
  role: string | null;
  word: string | null;
}

interface RoomStateView {
  phase: string;
  attempt: number;
  players: RedactedPlayer[];
  winner: string | null;
  viewerPlayerId: string;
}

function waitForState(
  socket: ClientSocket,
  predicate: (state: RoomStateView) => boolean,
  timeoutMs = 15000,
): Promise<RoomStateView> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off('room:state', handler);
      reject(new Error('Timed out waiting for a matching room:state'));
    }, timeoutMs);
    function handler(state: RoomStateView) {
      if (predicate(state)) {
        clearTimeout(timer);
        socket.off('room:state', handler);
        resolve(state);
      }
    }
    socket.on('room:state', handler);
  });
}

function waitForEvent<T>(socket: ClientSocket, event: string, timeoutMs = 15000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for ${event}`)),
      timeoutMs,
    );
    socket.once(event, (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    });
  });
}

describe('Rooms (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let baseUrl: string;
  let roomId = '';
  const sockets: ClientSocket[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    await app.listen(0);
    const address = app.getHttpServer().address();
    const port = typeof address === 'object' && address ? address.port : 0;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    for (const socket of sockets) socket.disconnect();
    if (roomId) {
      await prisma.room.delete({ where: { id: roomId } }).catch(() => undefined);
    }
    await app.close();
  });

  it('plays a full classique game online, with a tie/revote and per-viewer secrecy', async () => {
    // --- Création + jointures (REST) -----------------------------------
    const hostRes = await request(app.getHttpServer())
      .post('/rooms')
      .send({ displayName: 'Hôte' })
      .expect(201);
    const host = hostRes.body as RoomJoinResponse;
    roomId = host.roomId;

    const joiners: RoomJoinResponse[] = [];
    for (const displayName of ['Agent 2', 'Agent 3', 'Agent 4']) {
      const res = await request(app.getHttpServer())
        .post(`/rooms/${host.code}/join`)
        .send({ displayName })
        .expect(201);
      joiners.push(res.body as RoomJoinResponse);
    }
    const players = [host, ...joiners];

    // --- Connexions socket, une par joueur -------------------------------
    const clients = players.map((player) =>
      io(`${baseUrl}/rooms`, {
        auth: { token: player.playerToken },
        transports: ['websocket'],
        forceNew: true,
      }),
    );
    sockets.push(...clients);
    const [hostSocket, ...guestSockets] = clients;

    await Promise.all(clients.map((socket) => waitForState(socket, () => true)));

    // --- Lancement --------------------------------------------------------
    hostSocket.emit('room:start');
    await Promise.all(
      clients.map((socket) => waitForState(socket, (state) => state.phase === 'reveal')),
    );

    // --- Révélation : chacun accuse réception de sa propre carte ----------
    for (const socket of clients) socket.emit('reveal:ack');
    await Promise.all(
      clients.map((socket) => waitForState(socket, (state) => state.phase === 'describe')),
    );

    // --- Tour de description : l'hôte fait défiler jusqu'au vote ----------
    for (let i = 0; i < players.length; i++) {
      const next = waitForState(hostSocket, () => true);
      hostSocket.emit('describe:next');
      // eslint-disable-next-line no-await-in-loop
      const state = await next;
      if (state.phase === 'vote') break;
    }

    // --- Manche 1 : égalité délibérée entre p3 et p4 -----------------------
    const p3 = joiners[1]!.playerId;
    const p4 = joiners[2]!.playerId;

    const tieEvents = Promise.all(
      clients.map((socket) => waitForEvent<{ tiedPlayerIds: string[] }>(socket, 'vote:tie')),
    );
    // p3 (Agent 3) et p4 (Agent 4) ne peuvent pas voter pour eux-mêmes : c'est
    // l'hôte et p4 qui votent p4, Agent 2 et p3 qui votent p3, pour 2-2.
    hostSocket.emit('vote:cast', { targetPlayerId: p4 });
    guestSockets[0]!.emit('vote:cast', { targetPlayerId: p3 }); // Agent 2 -> p3
    guestSockets[1]!.emit('vote:cast', { targetPlayerId: p4 }); // Agent 3 (p3) -> p4
    guestSockets[2]!.emit('vote:cast', { targetPlayerId: p3 }); // Agent 4 (p4) -> p3

    const ties = await tieEvents;
    expect(ties[0]!.tiedPlayerIds.sort()).toEqual([p3, p4].sort());
    await Promise.all(clients.map((socket) => waitForState(socket, (state) => state.attempt === 2)));

    // --- Manche 2 : majorité nette pour p3 ----------------------------------
    const resolvedEvents = Promise.all(
      clients.map((socket) =>
        waitForEvent<{ eliminatedPlayerId: string; wasRandomTiebreak: boolean }>(
          socket,
          'vote:resolved',
        ),
      ),
    );
    hostSocket.emit('vote:cast', { targetPlayerId: p3 });
    guestSockets[0]!.emit('vote:cast', { targetPlayerId: p3 });
    guestSockets[1]!.emit('vote:cast', { targetPlayerId: p4 }); // p3 vote pour p4
    guestSockets[2]!.emit('vote:cast', { targetPlayerId: p3 });

    const resolutions = await resolvedEvents;
    for (const resolution of resolutions) {
      expect(resolution.eliminatedPlayerId).toBe(p3);
      expect(resolution.wasRandomTiebreak).toBe(false);
    }

    const statesAfterElimination = await Promise.all(
      clients.map((socket) => waitForState(socket, (state) => state.phase === 'elimination')),
    );

    // Secret respecté pour tout le monde, vérifié depuis chaque socket : c'est
    // ce qu'aucun test unitaire ne peut garantir seul — que le gateway appelle
    // bien la rédaction à CHAQUE diffusion, pour CHAQUE spectateur.
    for (const state of statesAfterElimination) {
      const eliminated = state.players.find((player) => player.id === p3)!;
      expect(eliminated.role).not.toBeNull();
      expect(eliminated.word).not.toBeNull();

      for (const player of state.players) {
        if (player.id === p3) continue; // déjà vérifié ci-dessus : visible pour tous
        if (player.id === state.viewerPlayerId) continue; // soi-même : toujours visible
        if (!player.alive) continue; // grillé lors d'une manche précédente : resterait visible
        expect(player.role).toBeNull();
        expect(player.word).toBeNull();
      }
    }

    // --- Poursuite après l'élimination --------------------------------------
    const afterContinue = Promise.all(
      clients.map((socket) =>
        waitForState(socket, (state) => state.phase === 'victory' || state.phase === 'describe'),
      ),
    );
    hostSocket.emit('elimination:continue');
    const finalStates = await afterContinue;

    for (const state of finalStates) {
      expect(['victory', 'describe']).toContain(state.phase);
      if (state.phase === 'victory') {
        expect(['civils', 'undercovers']).toContain(state.winner);
        // Débriefing final : tout le monde voit tous les rôles/mots.
        expect(state.players.every((player) => player.role !== null)).toBe(true);
      }
    }
  });
});
