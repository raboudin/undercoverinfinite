import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ACCESS_TOKEN_COOKIE,
  AUTH_CONFIG,
  type AuthConfig,
} from '../auth.config';
import { readCookie } from '../auth.cookies';
import type { AccessTokenPayload, AuthenticatedUser } from '../auth.types';

/**
 * Vérifie l'access token lu **dans le cookie httpOnly**, jamais dans l'en-tête
 * `Authorization` : côté navigateur le front n'a pas accès au token, il ne
 * peut donc pas le poser lui-même dans un en-tête.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @Inject(AUTH_CONFIG) config: AuthConfig,
    private readonly prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors<Request>([
        (req) => readCookie(req, ACCESS_TOKEN_COOKIE) ?? null,
      ]),
      ignoreExpiration: false,
      secretOrKey: config.jwtSecret,
    });
  }

  /**
   * Un token signé mais dont le compte a disparu ne doit pas rester valable
   * jusqu'à son expiration : on relit l'utilisateur à chaque requête.
   */
  async validate(payload: AccessTokenPayload): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user) {
      throw new UnauthorizedException('Compte introuvable.');
    }
    return { id: user.id, email: user.email, displayName: user.displayName };
  }
}
