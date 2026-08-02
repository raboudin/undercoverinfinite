import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Les mots du jour sont des données publiques : CORS ouvert, le frontend
  // vit sur une autre origine (localhost:3000 en dev, *.undercoverinfinite.com ensuite).
  app.enableCors();
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
