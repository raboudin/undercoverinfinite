import { Controller, Get } from '@nestjs/common';
import {
  EntitlementsService,
  type EntitlementsDto,
} from './entitlements.service';

@Controller('entitlements')
export class EntitlementsController {
  constructor(private readonly entitlements: EntitlementsService) {}

  /**
   * Thèmes et paliers de difficulté disponibles — le jeu est gratuit et
   * ouvert à tous, cette réponse est la même pour un anonyme ou un compte.
   */
  @Get()
  resolve(): EntitlementsDto {
    return this.entitlements.resolve();
  }
}
