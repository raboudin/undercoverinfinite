import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AUTH_CONFIG, type AuthConfig } from '../auth/auth.config';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { DEFAULT_THEME } from '../entitlements/catalog';
import { resolveSubject } from '../entitlements/subject';
import { DrawWordsDto } from './dto/draw-words.dto';
import { WordsService, type DrawDto } from './words.service';

@Controller('words')
export class WordsController {
  constructor(
    private readonly words: WordsService,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  /**
   * Tire les mots d'une partie. `POST` et non `GET` : l'appel débite un crédit
   * et peut déclencher une génération — il n'est ni sûr ni idempotent, et ne
   * doit surtout pas se faire rejouer par un cache ou un préchargement.
   *
   * Ouvert aux joueurs sans compte (`OptionalJwtAuthGuard`), avec le quota
   * accroché au cookie d'appareil.
   */
  @Post('draw')
  @HttpCode(HttpStatus.OK)
  @UseGuards(OptionalJwtAuthGuard)
  draw(
    @Body() dto: DrawWordsDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<DrawDto> {
    return this.words.draw(
      resolveSubject(req, res, this.config),
      dto.mode,
      dto.theme ?? DEFAULT_THEME,
    );
  }
}
