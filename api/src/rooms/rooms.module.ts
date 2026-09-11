import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { WordsModule } from '../words/words.module';
import { RoomsController } from './rooms.controller';
import { RoomsGateway } from './rooms.gateway';
import { RoomsService } from './rooms.service';

/**
 * `AuthModule` pour `AUTH_CONFIG` (réglages de cookie, utilisés par
 * `resolveSubject` dans le contrôleur), `EntitlementsModule` pour que
 * `WordsModule` fonctionne (le tirage de mots au lancement d'une partie
 * dépend des droits), `WordsModule` pour `WordsService` — injecté en process
 * par `RoomsService` pour débiter le crédit de l'hôte sans repasser par HTTP.
 */
@Module({
  imports: [AuthModule, EntitlementsModule, WordsModule],
  controllers: [RoomsController],
  providers: [RoomsService, RoomsGateway],
})
export class RoomsModule {}
