import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { corsOrigins } from '../app.setup';
import { CastVoteDto } from './dto/cast-vote.dto';
import { ConfigureRoomDto } from './dto/configure-room.dto';
import { RoomsService } from './rooms.service';

interface RoomSocketData {
  playerId: string;
  roomId: string;
}

/**
 * Gateway Socket.IO d'une salle. Toute action de jeu passe par ici une fois
 * la salle rejointe (la création/jointure elle-même reste en REST, voir
 * `rooms.controller.ts`, à cause du cookie `device_id`).
 *
 * Règle transverse : l'acteur d'une action est TOUJOURS `client.data.playerId`
 * fixé à la connexion — jamais un `playerId` fourni dans un payload. C'est ce
 * qui rend le serveur autoritaire plutôt que client-de-confiance.
 */
@WebSocketGateway({
  namespace: '/rooms',
  cors: { origin: corsOrigins(), credentials: true },
})
@UsePipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))
export class RoomsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  private readonly server!: Server;

  private readonly logger = new Logger(RoomsGateway.name);

  constructor(private readonly rooms: RoomsService) {}

  /**
   * Authentifie par le jeton opaque envoyé dans `handshake.auth.token` (pas un
   * cookie : ce jeton identifie un siège dans une salle, il vit côté client en
   * `localStorage`, pas dans les cookies httpOnly de session).
   */
  async handleConnection(client: Socket): Promise<void> {
    const auth = client.handshake.auth as { token?: unknown };
    const token = typeof auth.token === 'string' ? auth.token : null;
    if (!token) {
      this.rejectConnection(client, 'Jeton de salle manquant.');
      return;
    }

    const identity = await this.rooms.authenticate(token);
    if (!identity) {
      this.rejectConnection(client, 'Jeton de salle invalide ou expiré.');
      return;
    }

    Object.assign(client.data as object, identity satisfies RoomSocketData);

    // Deux salons Socket.IO par joueur : celui de la salle (diffusions de
    // présence) et un salon personnel (`player:<id>`) pour qu'un état rédigé
    // pour lui seul atteigne tous ses onglets ouverts, jamais les autres.
    await client.join(this.roomKey(identity.roomId));
    await client.join(this.playerKey(identity.playerId));
    await this.rooms.setConnected(identity.playerId, true);

    await this.broadcastState(identity.roomId);
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const data = client.data as Partial<RoomSocketData>;
    if (!data.playerId || !data.roomId) return;
    await this.rooms.setConnected(data.playerId, false);
    await this.broadcastState(data.roomId);
  }

  /* ------------------------------------------------------------------ */
  /* Lobby                                                               */
  /* ------------------------------------------------------------------ */

  @SubscribeMessage('room:configure')
  async onConfigure(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: ConfigureRoomDto,
  ): Promise<void> {
    await this.handle(client, (roomId, playerId) => this.rooms.configure(roomId, playerId, dto));
  }

  @SubscribeMessage('room:start')
  async onStart(@ConnectedSocket() client: Socket): Promise<void> {
    await this.handle(client, (roomId, playerId) => this.rooms.start(roomId, playerId));
  }

  @SubscribeMessage('game:replay')
  async onReplay(@ConnectedSocket() client: Socket): Promise<void> {
    await this.handle(client, (roomId, playerId) => this.rooms.replay(roomId, playerId));
  }

  @SubscribeMessage('room:leave')
  async onLeave(@ConnectedSocket() client: Socket): Promise<void> {
    const { roomId, playerId } = client.data as RoomSocketData;
    await this.rooms.leave(roomId, playerId);
    await client.leave(this.roomKey(roomId));
    await this.broadcastState(roomId);
    client.disconnect(true);
  }

  /* ------------------------------------------------------------------ */
  /* Révélation / description                                           */
  /* ------------------------------------------------------------------ */

  @SubscribeMessage('reveal:ack')
  async onRevealAck(@ConnectedSocket() client: Socket): Promise<void> {
    await this.handle(client, (roomId, playerId) => this.rooms.ackReveal(roomId, playerId));
  }

  @SubscribeMessage('describe:next')
  async onDescribeNext(@ConnectedSocket() client: Socket): Promise<void> {
    await this.handle(client, (roomId, playerId) => this.rooms.nextSpeaker(roomId, playerId));
  }

  /* ------------------------------------------------------------------ */
  /* Vote                                                                */
  /* ------------------------------------------------------------------ */

  @SubscribeMessage('vote:cast')
  async onVoteCast(
    @ConnectedSocket() client: Socket,
    @MessageBody() dto: CastVoteDto,
  ): Promise<void> {
    const { roomId, playerId } = client.data as RoomSocketData;
    try {
      const result = await this.rooms.castVote(roomId, playerId, dto.targetPlayerId);
      // Le vote est public par choix produit : chaque clic est déjà visible en
      // direct via `room:state.votes` (non rédacté, voir `rooms.service.ts`).
      // Ces deux événements ne portent que la RÉSOLUTION du tour, pour que le
      // front affiche un bandeau ("égalité, nouveau vote" / "X est démasqué")
      // sans avoir à deviner la transition en diffant l'état.
      if (result.tie) {
        this.server
          .to(this.roomKey(roomId))
          .emit('vote:tie', { tiedPlayerIds: result.tiedPlayerIds });
      } else if (result.resolved) {
        this.server.to(this.roomKey(roomId)).emit('vote:resolved', {
          eliminatedPlayerId: result.eliminatedPlayerId,
          wasRandomTiebreak: result.wasRandomTiebreak,
        });
      }
    } catch (error) {
      this.emitError(client, error);
      return;
    }
    await this.broadcastState(roomId);
  }

  @SubscribeMessage('elimination:continue')
  async onContinue(@ConnectedSocket() client: Socket): Promise<void> {
    await this.handle(client, (roomId, playerId) =>
      this.rooms.continueAfterElimination(roomId, playerId),
    );
  }

  /* ------------------------------------------------------------------ */
  /* Diffusion                                                           */
  /* ------------------------------------------------------------------ */

  /**
   * Envoie à CHAQUE joueur connecté de la salle sa propre vue rédigée du même
   * état. Jamais de diffusion room-wide contenant rôle/mot (voir
   * `redaction.ts`) — c'est cette fonction, et uniquement elle, qui alimente
   * `room:state` après toute action de jeu.
   */
  private async broadcastState(roomId: string): Promise<void> {
    const sockets = await this.server.in(this.roomKey(roomId)).fetchSockets();
    const seen = new Set<string>();
    for (const socket of sockets) {
      const data = socket.data as Partial<RoomSocketData>;
      if (!data.playerId || seen.has(data.playerId)) continue;
      seen.add(data.playerId);
      try {
        const state = await this.rooms.getState(roomId, data.playerId);
        this.server.to(this.playerKey(data.playerId)).emit('room:state', state);
      } catch (error) {
        this.logger.error(`État de salle illisible pour ${data.playerId}`, error);
      }
    }
  }

  /* ------------------------------------------------------------------ */
  /* Utilitaires                                                         */
  /* ------------------------------------------------------------------ */

  private roomKey(roomId: string): string {
    return `room:${roomId}`;
  }

  private playerKey(playerId: string): string {
    return `player:${playerId}`;
  }

  private rejectConnection(client: Socket, message: string): void {
    client.emit('room:error', { message });
    client.disconnect(true);
  }

  private emitError(client: Socket, error: unknown): void {
    const message = error instanceof Error ? error.message : 'Action impossible.';
    client.emit('room:error', { message });
  }

  /** Exécute une action de jeu, diffuse l'état neuf sur succès, ou renvoie l'erreur au seul appelant. */
  private async handle(
    client: Socket,
    action: (roomId: string, playerId: string) => Promise<void>,
  ): Promise<void> {
    const { roomId, playerId } = client.data as RoomSocketData;
    try {
      await action(roomId, playerId);
    } catch (error) {
      this.emitError(client, error);
      return;
    }
    await this.broadcastState(roomId);
  }
}
