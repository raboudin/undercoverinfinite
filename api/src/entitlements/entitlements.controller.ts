import { Controller, Get, Inject, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AUTH_CONFIG, type AuthConfig } from '../auth/auth.config';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import {
  EntitlementsService,
  type EntitlementsDto,
} from './entitlements.service';
import { resolveSubject } from './subject';

@Controller('entitlements')
export class EntitlementsController {
  constructor(
    private readonly entitlements: EntitlementsService,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  /**
   * Ce à quoi le joueur a droit ici et maintenant. Ouvert aux anonymes : c'est
   * cette réponse qui dit au front quels modes afficher et combien de parties
   * il reste, y compris sans compte.
   *
   * `passthrough` parce que `resolveSubject` peut avoir à poser le cookie
   * d'appareil sur cette réponse.
   */
  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  resolve(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<EntitlementsDto> {
    return this.entitlements.resolve(resolveSubject(req, res, this.config));
  }
}
