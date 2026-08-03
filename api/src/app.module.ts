import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PrismaModule } from './prisma/prisma.module';
import { WordsModule } from './words/words.module';

@Module({
  imports: [PrismaModule, ScheduleModule.forRoot(), AuthModule, WordsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
