import { Body, Controller, Get, Inject, Param, Post, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AUTH_CONFIG, type AuthConfig } from '../auth/auth.config';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { resolveSubject } from '../entitlements/subject';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import {
  RoomsService,
  type RoomJoinResult,
  type RoomPreviewDto,
} from './rooms.service';

/**
 * Création et jointure restent des routes HTTP (et non des événements
 * Socket.IO) parce que `resolveSubject` a besoin d'une vraie `Response`
 * mutable pour poser le cookie `device_id` d'un hôte ou d'un invité anonyme —
 * un handshake de socket ne peut pas porter de `Set-Cookie`. Tout le reste
 * d'une partie (config, lancement, votes, élimination…) passe par
 * `RoomsGateway`, seul transport autoritaire une fois dans la salle.
 */
@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly rooms: RoomsService,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  @Post()
  @UseGuards(OptionalJwtAuthGuard)
  create(
    @Body() dto: CreateRoomDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RoomJoinResult> {
    return this.rooms.createRoom(
      resolveSubject(req, res, this.config),
      dto.displayName,
      dto.mode,
      dto.theme,
    );
  }

  @Post(':code/join')
  @UseGuards(OptionalJwtAuthGuard)
  join(
    @Param('code') code: string,
    @Body() dto: JoinRoomDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RoomJoinResult> {
    return this.rooms.joinRoom(
      code.toUpperCase(),
      dto.displayName,
      resolveSubject(req, res, this.config),
    );
  }

  /** Aperçu public, sans résolution de sujet : sert juste à afficher la salle avant de rejoindre. */
  @Get(':code')
  preview(@Param('code') code: string): Promise<RoomPreviewDto> {
    return this.rooms.previewRoom(code.toUpperCase());
  }
}
