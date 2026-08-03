import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { EntitlementsModule } from './entitlements/entitlements.module';
import { PrismaModule } from './prisma/prisma.module';
import { WordsModule } from './words/words.module';

// Plus de `ScheduleModule` : les mots ne sont plus produits par un cron
// quotidien mais à la demande, quand un tirage n'a plus rien d'inédit à servir.
@Module({
  imports: [PrismaModule, AuthModule, EntitlementsModule, WordsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
