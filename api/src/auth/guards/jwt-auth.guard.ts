import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Protège une route avec l'access token du cookie (voir `JwtStrategy`).
 * Répond 401 si le cookie est absent, expiré ou signé avec un autre secret.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
