import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { TokenService } from '../auth/token.service';
import {
  DEFAULT_DIFFICULTY,
  DEFAULT_THEME,
  difficultyFromLevel,
  difficultyLevel,
  type DifficultyId,
  type ThemeId,
} from '../entitlements/catalog';
import type { Subject } from '../entitlements/subject';
import { PrismaService } from '../prisma/prisma.service';
import { isUniqueViolation } from '../prisma/prisma.errors';
import { WordsService } from '../words/words.service';
import type { ConfigureRoomDto } from './dto/configure-room.dto';
import { dealRoles } from './engine/deal';
import { speakingOrder } from './engine/speaking-order';
import { MAX_PLAYERS, validatePlayerCount, validateUndercoverCount } from './engine/validate';
import { checkVictory } from './engine/victory';
import { resolveVotes } from './engine/voting';
import { redactPlayers, type RedactedPlayer } from './redaction';
import { generateRoomCode } from './room-code';

export interface RoomJoinResult {
  code: string;
  roomId: string;
  playerId: string;
  playerToken: string;
  displayName: string;
  isHost: boolean;
}

export interface RoomPreviewDto {
  exists: boolean;
  phase?: string;
  playerCount?: number;
  hostDisplayName?: string | null;
}

export interface RoomStateView {
  roomId: string;
  code: string;
  phase: string;
  theme: string;
  spicy: boolean;
  difficulty: DifficultyId;
  undercoverCount: number | null;
  round: number;
  attempt: number;
  speakerIndex: number;
  speakingOrder: string[];
  lastEliminatedPlayerId: string | null;
  winner: string | null;
  dealNumber: number;
  viewerPlayerId: string;
  isHost: boolean;
  players: RedactedPlayer[];
  votes: { voterId: string; targetId: string }[];
}

export interface VoteCastResult {
  resolved: boolean;
  tie?: boolean;
  tiedPlayerIds?: string[];
  eliminatedPlayerId?: string;
  wasRandomTiebreak?: boolean;
}

/** Reconstruit un `Subject` (`entitlements/subject.ts`) depuis sa forme stockée. */
function subjectFromKey(key: string): Subject {
  return { key, userId: key.startsWith('user:') ? key.slice('user:'.length) : null };
}

@Injectable()
export class RoomsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly words: WordsService,
  ) {}

  /* ------------------------------------------------------------------ */
  /* Création / jointure (REST — voir rooms.controller.ts)               */
  /* ------------------------------------------------------------------ */

  async createRoom(
    subject: Subject,
    displayName: string,
    theme?: ThemeId,
    spicy?: boolean,
    difficulty?: DifficultyId,
  ): Promise<RoomJoinResult> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = generateRoomCode();
      const token = randomBytes(32).toString('base64url');

      try {
        const player = await this.prisma.$transaction(async (tx) => {
          const room = await tx.room.create({
            data: {
              code,
              theme: theme ?? DEFAULT_THEME,
              spicy: spicy ?? false,
              difficulty: difficultyLevel(difficulty ?? DEFAULT_DIFFICULTY),
            },
          });
          const created = await tx.roomPlayer.create({
            data: {
              roomId: room.id,
              subjectKey: subject.key,
              displayName,
              isHost: true,
              playerTokenHash: TokenService.hash(token),
            },
          });
          await tx.room.update({
            where: { id: room.id },
            data: { hostPlayerId: created.id },
          });
          return created;
        });

        return {
          code,
          roomId: player.roomId,
          playerId: player.id,
          playerToken: token,
          displayName: player.displayName,
          isHost: true,
        };
      } catch (error) {
        // Collision sur le code (ou, de façon infinitésimalement improbable,
        // sur le hash du jeton) : on retente avec un code et un jeton neufs.
        if (isUniqueViolation(error)) continue;
        throw error;
      }
    }
    throw new ServiceUnavailableException('Impossible de créer la salle, réessaie.');
  }

  async joinRoom(code: string, displayName: string, subject: Subject): Promise<RoomJoinResult> {
    const room = await this.prisma.room.findUnique({ where: { code } });
    if (!room) throw new NotFoundException('Salle introuvable.');
    if (room.phase !== 'lobby') {
      throw new ForbiddenException('La partie a déjà commencé.');
    }

    const playerCount = await this.prisma.roomPlayer.count({ where: { roomId: room.id } });
    if (playerCount >= MAX_PLAYERS) {
      throw new ForbiddenException('La salle est complète.');
    }

    const token = randomBytes(32).toString('base64url');
    const player = await this.prisma.roomPlayer.create({
      data: {
        roomId: room.id,
        subjectKey: subject.key,
        displayName,
        isHost: false,
        playerTokenHash: TokenService.hash(token),
      },
    });

    return {
      code,
      roomId: room.id,
      playerId: player.id,
      playerToken: token,
      displayName: player.displayName,
      isHost: false,
    };
  }

  async previewRoom(code: string): Promise<RoomPreviewDto> {
    const room = await this.prisma.room.findUnique({ where: { code } });
    if (!room) return { exists: false };

    const [playerCount, host] = await Promise.all([
      this.prisma.roomPlayer.count({ where: { roomId: room.id } }),
      room.hostPlayerId
        ? this.prisma.roomPlayer.findUnique({ where: { id: room.hostPlayerId } })
        : null,
    ]);

    return {
      exists: true,
      phase: room.phase,
      playerCount,
      hostDisplayName: host?.displayName ?? null,
    };
  }

  /* ------------------------------------------------------------------ */
  /* Connexion socket                                                    */
  /* ------------------------------------------------------------------ */

  /** Authentifie une connexion socket par son jeton opaque (voir handshake). */
  async authenticate(token: string): Promise<{ playerId: string; roomId: string } | null> {
    const player = await this.prisma.roomPlayer.findUnique({
      where: { playerTokenHash: TokenService.hash(token) },
    });
    if (!player) return null;
    return { playerId: player.id, roomId: player.roomId };
  }

  async setConnected(playerId: string, connected: boolean): Promise<void> {
    await this.prisma.roomPlayer.updateMany({ where: { id: playerId }, data: { connected } });
  }

  /* ------------------------------------------------------------------ */
  /* État (diffusion)                                                    */
  /* ------------------------------------------------------------------ */

  /**
   * État complet d'une salle, rédigé pour un spectateur précis. C'est la
   * seule fonction qui doit alimenter un `room:state` — jamais une lecture
   * Prisma brute, sous peine de fuir un rôle ou un mot (voir `redaction.ts`).
   */
  async getState(roomId: string, viewerPlayerId: string): Promise<RoomStateView> {
    const room = await this.prisma.room.findUniqueOrThrow({ where: { id: roomId } });
    const players = await this.prisma.roomPlayer.findMany({
      where: { roomId },
      orderBy: [{ seat: 'asc' }, { joinedAt: 'asc' }],
    });
    const votes = await this.prisma.roomVote.findMany({
      where: {
        roomId,
        dealNumber: room.dealNumber,
        round: room.round,
        attempt: room.attempt,
      },
      select: { voterId: true, targetId: true },
    });

    const order = speakingOrder(players, room.round);
    const viewer = players.find((player) => player.id === viewerPlayerId);

    return {
      roomId: room.id,
      code: room.code,
      phase: room.phase,
      theme: room.theme,
      spicy: room.spicy,
      difficulty: difficultyFromLevel(room.difficulty),
      undercoverCount: room.undercoverCount,
      round: room.round,
      attempt: room.attempt,
      speakerIndex: room.speakerIndex,
      speakingOrder: order.map((player) => player.id),
      lastEliminatedPlayerId: room.lastEliminatedPlayerId,
      winner: room.winner,
      dealNumber: room.dealNumber,
      viewerPlayerId,
      isHost: viewer?.isHost ?? false,
      players: redactPlayers(players, viewerPlayerId, room.phase),
      votes,
    };
  }

  /* ------------------------------------------------------------------ */
  /* Lobby                                                               */
  /* ------------------------------------------------------------------ */

  async configure(roomId: string, actorPlayerId: string, dto: ConfigureRoomDto): Promise<void> {
    const [room, actor] = await Promise.all([
      this.prisma.room.findUniqueOrThrow({ where: { id: roomId } }),
      this.prisma.roomPlayer.findUniqueOrThrow({ where: { id: actorPlayerId } }),
    ]);
    if (!actor.isHost) throw new ForbiddenException('Seul l’hôte règle la partie.');
    if (room.phase !== 'lobby') {
      throw new ForbiddenException('La configuration est verrouillée une fois la partie lancée.');
    }

    if (dto.undercoverCount !== undefined) {
      const playerCount = await this.prisma.roomPlayer.count({ where: { roomId } });
      const problem = validateUndercoverCount(playerCount, dto.undercoverCount);
      if (problem) throw new BadRequestException(problem);
    }

    await this.prisma.room.update({
      where: { id: roomId },
      data: {
        ...(dto.theme ? { theme: dto.theme } : {}),
        ...(dto.spicy !== undefined ? { spicy: dto.spicy } : {}),
        ...(dto.difficulty ? { difficulty: difficultyLevel(dto.difficulty) } : {}),
        ...(dto.undercoverCount !== undefined ? { undercoverCount: dto.undercoverCount } : {}),
      },
    });
  }

  /* ------------------------------------------------------------------ */
  /* Distribution (lancement / replay)                                   */
  /* ------------------------------------------------------------------ */

  async start(roomId: string, actorPlayerId: string): Promise<void> {
    const room = await this.prisma.room.findUniqueOrThrow({ where: { id: roomId } });
    const actor = await this.prisma.roomPlayer.findUniqueOrThrow({ where: { id: actorPlayerId } });
    if (!actor.isHost) throw new ForbiddenException('Seul l’hôte lance la partie.');
    if (room.phase !== 'lobby') throw new ForbiddenException('La partie est déjà lancée.');

    const players = await this.prisma.roomPlayer.findMany({
      where: { roomId },
      orderBy: { joinedAt: 'asc' },
    });

    const countProblem = validatePlayerCount(players.length);
    if (countProblem) throw new BadRequestException(countProblem);

    const undercoverCount = room.undercoverCount ?? 1;
    const undercoverProblem = validateUndercoverCount(players.length, undercoverCount);
    if (undercoverProblem) throw new BadRequestException(undercoverProblem);

    const host = players.find((player) => player.id === actor.id)!;
    const draw = await this.words.draw(
      subjectFromKey(host.subjectKey),
      room.theme as ThemeId,
      room.spicy,
      difficultyFromLevel(room.difficulty),
    );

    const assignments = dealRoles(
      players.map((player) => player.id),
      undercoverCount,
      draw.pair,
    );

    await this.prisma.$transaction([
      ...assignments.map((assignment) =>
        this.prisma.roomPlayer.update({
          where: { id: assignment.playerId },
          data: {
            seat: assignment.seat,
            role: assignment.role,
            word: assignment.word,
            alive: true,
            hasSeenReveal: false,
          },
        }),
      ),
      this.prisma.room.update({
        where: { id: roomId },
        data: {
          phase: 'reveal',
          round: 0,
          speakerIndex: 0,
          attempt: 1,
          lastEliminatedPlayerId: null,
          winner: null,
          undercoverCount,
        },
      }),
    ]);
  }

  async replay(roomId: string, actorPlayerId: string): Promise<void> {
    const room = await this.prisma.room.findUniqueOrThrow({ where: { id: roomId } });
    const actor = await this.prisma.roomPlayer.findUniqueOrThrow({ where: { id: actorPlayerId } });
    if (!actor.isHost) throw new ForbiddenException('Seul l’hôte relance la partie.');
    if (room.phase !== 'victory') throw new ForbiddenException('La partie n’est pas terminée.');

    const players = await this.prisma.roomPlayer.findMany({
      where: { roomId },
      orderBy: { seat: 'asc' },
    });
    const host = players.find((player) => player.id === actor.id)!;
    const draw = await this.words.draw(
      subjectFromKey(host.subjectKey),
      room.theme as ThemeId,
      room.spicy,
      difficultyFromLevel(room.difficulty),
    );

    const assignments = dealRoles(
      players.map((player) => player.id),
      room.undercoverCount ?? 1,
      draw.pair,
    );

    await this.prisma.$transaction([
      ...assignments.map((assignment) =>
        this.prisma.roomPlayer.update({
          where: { id: assignment.playerId },
          data: {
            role: assignment.role,
            word: assignment.word,
            alive: true,
            hasSeenReveal: false,
          },
        }),
      ),
      this.prisma.room.update({
        where: { id: roomId },
        data: {
          phase: 'reveal',
          round: 0,
          speakerIndex: 0,
          attempt: 1,
          lastEliminatedPlayerId: null,
          winner: null,
          dealNumber: { increment: 1 },
        },
      }),
    ]);
  }

  /* ------------------------------------------------------------------ */
  /* Révélation / description                                           */
  /* ------------------------------------------------------------------ */

  async ackReveal(roomId: string, playerId: string): Promise<void> {
    const room = await this.prisma.room.findUniqueOrThrow({ where: { id: roomId } });
    if (room.phase !== 'reveal') return;

    await this.prisma.roomPlayer.update({
      where: { id: playerId },
      data: { hasSeenReveal: true },
    });

    const pending = await this.prisma.roomPlayer.count({
      where: { roomId, alive: true, hasSeenReveal: false },
    });
    if (pending > 0) return;

    // Compare-and-swap : si deux acquittements se croisent, un seul déclenche
    // la transition (l'autre trouve `phase` déjà changée).
    await this.prisma.room.updateMany({
      where: { id: roomId, phase: 'reveal' },
      data: { phase: 'describe', round: 1, speakerIndex: 0 },
    });
  }

  async nextSpeaker(roomId: string, actorPlayerId: string): Promise<void> {
    const room = await this.prisma.room.findUniqueOrThrow({ where: { id: roomId } });
    if (room.phase !== 'describe') {
      throw new ForbiddenException('Ce n’est pas le moment de passer la parole.');
    }

    const players = await this.prisma.roomPlayer.findMany({
      where: { roomId },
      orderBy: { seat: 'asc' },
    });
    const actor = players.find((player) => player.id === actorPlayerId);
    if (!actor) throw new ForbiddenException('Agent inconnu dans cette salle.');

    const order = speakingOrder(players, room.round);
    const currentSpeaker = order[room.speakerIndex];
    if (!actor.isHost && currentSpeaker?.id !== actor.id) {
      throw new ForbiddenException('Seul l’agent qui parle peut passer la main.');
    }

    if (room.speakerIndex < order.length - 1) {
      await this.prisma.room.update({
        where: { id: roomId },
        data: { speakerIndex: { increment: 1 } },
      });
      return;
    }

    await this.prisma.room.update({
      where: { id: roomId },
      data: { speakerIndex: 0, phase: 'vote' },
    });
  }

  /* ------------------------------------------------------------------ */
  /* Vote                                                                */
  /* ------------------------------------------------------------------ */

  async castVote(roomId: string, voterId: string, targetPlayerId: string): Promise<VoteCastResult> {
    const room = await this.prisma.room.findUniqueOrThrow({ where: { id: roomId } });
    if (room.phase !== 'vote') throw new ForbiddenException('Le vote n’est pas ouvert.');
    if (voterId === targetPlayerId) {
      throw new BadRequestException('On ne vote pas contre soi-même.');
    }

    const [voter, target] = await Promise.all([
      this.prisma.roomPlayer.findUniqueOrThrow({ where: { id: voterId } }),
      this.prisma.roomPlayer.findUniqueOrThrow({ where: { id: targetPlayerId } }),
    ]);
    if (!voter.alive) throw new ForbiddenException('Un agent grillé ne vote plus.');
    if (target.roomId !== roomId || !target.alive) {
      throw new BadRequestException('Cible de vote invalide.');
    }

    try {
      await this.prisma.roomVote.create({
        data: {
          roomId,
          dealNumber: room.dealNumber,
          round: room.round,
          attempt: room.attempt,
          voterId,
          targetId: targetPlayerId,
        },
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Tu as déjà voté pour cette manche.');
      }
      throw error;
    }

    const aliveCount = await this.prisma.roomPlayer.count({ where: { roomId, alive: true } });
    const votes = await this.prisma.roomVote.findMany({
      where: {
        roomId,
        dealNumber: room.dealNumber,
        round: room.round,
        attempt: room.attempt,
      },
      select: { targetId: true },
    });
    if (votes.length < aliveCount) return { resolved: false };

    const outcome = resolveVotes(votes, room.attempt);

    if (outcome.outcome === 'tie') {
      // Compare-and-swap sur `attempt` : si deux derniers votes déclenchent le
      // dépouillement en même temps, un seul incrémente réellement la tentative.
      const { count } = await this.prisma.room.updateMany({
        where: { id: roomId, phase: 'vote', attempt: room.attempt },
        data: { attempt: { increment: 1 } },
      });
      if (count === 0) return { resolved: false };
      return { resolved: false, tie: true, tiedPlayerIds: outcome.tiedPlayerIds };
    }

    const { count } = await this.prisma.room.updateMany({
      where: { id: roomId, phase: 'vote' },
      data: { phase: 'elimination', lastEliminatedPlayerId: outcome.targetId },
    });
    if (count === 0) return { resolved: false };

    await this.prisma.roomPlayer.update({
      where: { id: outcome.targetId },
      data: { alive: false },
    });

    return {
      resolved: true,
      eliminatedPlayerId: outcome.targetId,
      wasRandomTiebreak: outcome.wasRandomTiebreak,
    };
  }

  /* ------------------------------------------------------------------ */
  /* Élimination / victoire                                              */
  /* ------------------------------------------------------------------ */

  async continueAfterElimination(roomId: string, actorPlayerId: string): Promise<void> {
    const [room, actor] = await Promise.all([
      this.prisma.room.findUniqueOrThrow({ where: { id: roomId } }),
      this.prisma.roomPlayer.findUniqueOrThrow({ where: { id: actorPlayerId } }),
    ]);
    if (!actor.isHost) throw new ForbiddenException('Seul l’hôte poursuit la partie.');
    if (room.phase !== 'elimination') {
      throw new ForbiddenException('Rien à poursuivre pour l’instant.');
    }

    const [aliveUndercovers, aliveCivils] = await Promise.all([
      this.prisma.roomPlayer.count({ where: { roomId, alive: true, role: 'undercover' } }),
      this.prisma.roomPlayer.count({ where: { roomId, alive: true, role: 'civil' } }),
    ]);

    const winner = checkVictory(aliveUndercovers, aliveCivils);
    if (winner) {
      await this.prisma.room.update({
        where: { id: roomId },
        data: { phase: 'victory', winner },
      });
      return;
    }

    await this.prisma.room.update({
      where: { id: roomId },
      data: { phase: 'describe', round: { increment: 1 }, speakerIndex: 0, attempt: 1 },
    });
  }

  /* ------------------------------------------------------------------ */
  /* Sortie                                                              */
  /* ------------------------------------------------------------------ */

  async leave(roomId: string, playerId: string): Promise<void> {
    const room = await this.prisma.room.findUnique({ where: { id: roomId } });
    if (!room) return;

    // En cours de partie, on garde la ligne (reconnexion possible) : seule la
    // présence change.
    if (room.phase !== 'lobby') {
      await this.prisma.roomPlayer.updateMany({
        where: { id: playerId },
        data: { connected: false },
      });
      return;
    }

    const leaving = await this.prisma.roomPlayer.findUnique({ where: { id: playerId } });
    if (!leaving) return;

    await this.prisma.roomPlayer.delete({ where: { id: playerId } });

    const remaining = await this.prisma.roomPlayer.findMany({
      where: { roomId },
      orderBy: { joinedAt: 'asc' },
    });

    if (remaining.length === 0) {
      await this.prisma.room.delete({ where: { id: roomId } }).catch(() => undefined);
      return;
    }

    if (leaving.isHost) {
      const nextHost = remaining[0]!;
      await this.prisma.$transaction([
        this.prisma.roomPlayer.update({ where: { id: nextHost.id }, data: { isHost: true } }),
        this.prisma.room.update({ where: { id: roomId }, data: { hostPlayerId: nextHost.id } }),
      ]);
    }
  }
}
