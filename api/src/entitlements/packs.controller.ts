import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PACK_IDS, type PackId } from './catalog';
import {
  EntitlementsService,
  type CatalogDto,
  type EntitlementsDto,
} from './entitlements.service';

@Controller('packs')
export class PacksController {
  constructor(private readonly entitlements: EntitlementsService) {}

  /** Vitrine : prix et contenu des packs. Aucun secret, aucune session. */
  @Get()
  catalog(): CatalogDto {
    return this.entitlements.catalog();
  }

  /**
   * Rattache un pack au compte. `JwtAuthGuard` et non son homologue optionnel :
   * un pack se rattache à un dossier d'agent, il n'existe pas de propriétaire
   * anonyme — c'est précisément ce qui rendra la reprise d'achat possible sur
   * un autre appareil.
   *
   * Aujourd'hui gratuit ; le jour où Stripe s'intercale, c'est ici que la
   * vérification du paiement se posera, avant l'appel à `unlock`.
   */
  @Post(':pack/unlock')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard)
  unlock(
    @Param('pack') pack: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<EntitlementsDto> {
    if (!(PACK_IDS as readonly string[]).includes(pack)) {
      throw new NotFoundException(`Pack inconnu : ${pack}`);
    }
    return this.entitlements.unlock(user.id, pack as PackId);
  }
}
