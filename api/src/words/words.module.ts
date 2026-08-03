import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { LlmClient } from './llm.client';
import { WordsController } from './words.controller';
import { WordsService } from './words.service';

/**
 * `AuthModule` pour reconnaître une session sans l'exiger (le tirage reste
 * ouvert aux anonymes), `EntitlementsModule` pour les droits et le débit du
 * crédit — c'est lui qui décide si la partie a le droit d'être servie.
 */
@Module({
  imports: [AuthModule, EntitlementsModule],
  controllers: [WordsController],
  providers: [WordsService, LlmClient],
})
export class WordsModule {}
