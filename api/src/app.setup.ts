import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

/**
 * Origines autorisées, en liste explicite : depuis que l'authentification
 * passe par des cookies, `enableCors()` sans argument (donc
 * `Access-Control-Allow-Origin: *`) n'est plus une option — le joker est
 * incompatible avec `credentials: true`, et l'autoriser reviendrait à laisser
 * n'importe quel site lire les réponses authentifiées de l'utilisateur.
 *
 * `CORS_ORIGINS` : liste séparée par des virgules. Défaut = le front en dev.
 */
export function corsOrigins(): string[] {
  const raw = process.env.CORS_ORIGINS?.trim();
  if (!raw) return ['http://localhost:3000'];
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

/**
 * Réglages partagés entre le vrai serveur (`main.ts`) et les tests e2e, qui
 * ne passent pas par `bootstrap()`. Sans ce partage, un test e2e « vert »
 * pourrait valider un comportement que la prod n'a pas (ou l'inverse).
 */
export function configureApp(app: INestApplication): void {
  // Les tokens voyagent en cookies httpOnly : sans ce parseur, `req.cookies`
  // reste vide et JwtStrategy ne trouve jamais l'access token.
  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({ origin: corsOrigins(), credentials: true });
}
