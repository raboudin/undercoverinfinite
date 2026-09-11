import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { WordsModule } from '../words/words.module';
import { RoomsController } from './rooms.controller';
import { RoomsGateway } from './rooms.gateway';
import { RoomsService } from './rooms.service';

/**
 * `AuthModule` pour `AUTH_CONFIG` (réglages de cookie, utilisés par
 * `resolveSubject` dans le contrôleur), `WordsModule` pour `WordsService` —
 * injecté en process par `RoomsService` pour tirer les mots au lancement
 * d'une partie sans repasser par HTTP.
 */
@Module({
  imports: [AuthModule, WordsModule],
  controllers: [RoomsController],
  providers: [RoomsService, RoomsGateway],
})
export class RoomsModule {}
