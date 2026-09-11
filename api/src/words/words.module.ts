import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { LlmClient } from './llm.client';
import { WordsController } from './words.controller';
import { WordsService } from './words.service';

/**
 * `AuthModule` pour reconnaître une session sans l'exiger (le tirage reste
 * ouvert aux anonymes, avec la dédup accrochée au cookie d'appareil sinon).
 *
 * `WordsService` est exporté pour `RoomsModule` : le lancement d'une partie en
 * ligne tire les mots en appelant `draw()` en process, sans repasser par
 * HTTP — ça préserve aussi la dédup en mémoire de `fillPool` (une deuxième
 * instance de service la casserait silencieusement).
 */
@Module({
  imports: [AuthModule],
  controllers: [WordsController],
  providers: [WordsService, LlmClient],
  exports: [WordsService],
})
export class WordsModule {}
