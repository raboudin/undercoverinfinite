import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EntitlementsController } from './entitlements.controller';
import { EntitlementsService } from './entitlements.service';
import { PacksController } from './packs.controller';

/**
 * `AuthModule` est importé pour la stratégie JWT et le jeton `AUTH_CONFIG` :
 * les routes d'ici reconnaissent une session sans l'exiger (voir
 * `OptionalJwtAuthGuard`), et posent le cookie d'appareil avec les mêmes
 * réglages `secure`/`sameSite` que les cookies d'auth.
 */
@Module({
  imports: [AuthModule],
  controllers: [EntitlementsController, PacksController],
  providers: [EntitlementsService],
  exports: [EntitlementsService],
})
export class EntitlementsModule {}
