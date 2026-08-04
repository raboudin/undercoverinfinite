import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Cron, CronExpression } from '@nestjs/schedule';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AUTH_CONFIG, type AuthConfig } from './auth.config';
import type { AccessTokenPayload, PublicUser, TokenPair } from './auth.types';
import { PUBLIC_USER_INCLUDE, toPublicUser } from './user.mapper';

/** Entropie du refresh token : 256 bits, tirés du CSPRNG de Node. */
const REFRESH_TOKEN_BYTES = 32;

/** Délai de garde avant purge des lignes mortes (audit à froid). */
const PURGE_GRACE_DAYS = 7;

/**
 * Émission, rotation et révocation des tokens.
 *
 * L'access token est un JWT signé (rien en base : il est vérifié par sa
 * signature). Le refresh token est au contraire une valeur opaque aléatoire
 * dont seule l'empreinte SHA-256 est stockée — c'est ce qui permet de le
 * révoquer, de le faire tourner, et de détecter sa réutilisation.
 *
 * SHA-256 nu (et non bcrypt/argon2) est le bon choix ici : le token fait
 * 256 bits d'aléa, il n'y a rien à deviner par force brute, et le hash doit
 * rester déterministe pour permettre la recherche par index unique.
 */
@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  /** Empreinte stockée en base. Jamais le token lui-même. */
  static hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /** Émet un access token neuf + un refresh token neuf, persisté. */
  async issuePair(user: PublicUser): Promise<TokenPair> {
    const payload: AccessTokenPayload = { sub: user.id, email: user.email };
    const accessToken = await this.jwt.signAsync(payload);

    const refreshToken = randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: TokenService.hash(refreshToken),
        expiresAt: new Date(
          Date.now() + this.config.refreshTokenTtlSeconds * 1000,
        ),
      },
    });

    return { accessToken, refreshToken };
  }

  /**
   * Rotation : le token présenté est consommé (révoqué) et remplacé par une
   * paire neuve. Un token déjà consommé qui revient signale une fuite — dans
   * ce cas toutes les sessions de l'utilisateur sautent, à lui de se
   * reconnecter.
   */
  async rotate(refreshToken: string): Promise<{
    user: PublicUser;
    tokens: TokenPair;
  }> {
    const record = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: TokenService.hash(refreshToken) },
      include: { user: { include: PUBLIC_USER_INCLUDE } },
    });

    if (!record) {
      throw new UnauthorizedException('Session invalide ou expirée.');
    }

    if (record.revokedAt) {
      await this.revokeAllForUser(record.userId);
      this.logger.warn(
        `Refresh token déjà consommé rejoué (user ${record.userId}) : toutes ses sessions ont été révoquées.`,
      );
      throw new UnauthorizedException('Session invalide ou expirée.');
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException('Session invalide ou expirée.');
    }

    // Révocation conditionnelle : `revokedAt: null` dans le filtre fait de
    // cette écriture un compare-and-swap. Deux requêtes /auth/refresh
    // simultanées avec le même token ne peuvent donc pas réussir toutes les
    // deux — la perdante est traitée comme un rejeu.
    const { count } = await this.prisma.refreshToken.updateMany({
      where: { id: record.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (count === 0) {
      await this.revokeAllForUser(record.userId);
      throw new UnauthorizedException('Session invalide ou expirée.');
    }

    const user = toPublicUser(record.user);
    return { user, tokens: await this.issuePair(user) };
  }

  /**
   * Révoque le token présenté (déconnexion). Silencieux si le token est
   * inconnu ou déjà révoqué : se déconnecter deux fois n'est pas une erreur.
   */
  async revoke(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: TokenService.hash(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Coupe toutes les sessions vivantes d'un utilisateur. */
  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Sans ça, `refresh_tokens` ne fait que grossir : chaque rotation y laisse
   * une ligne révoquée. On garde une semaine de recul pour pouvoir enquêter
   * sur un rejeu, puis on supprime.
   */
  @Cron(CronExpression.EVERY_DAY_AT_4AM)
  async purgeExpiredTokens(): Promise<void> {
    const cutoff = new Date(Date.now() - PURGE_GRACE_DAYS * 86400 * 1000);
    try {
      const { count } = await this.prisma.refreshToken.deleteMany({
        where: {
          OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }],
        },
      });
      if (count > 0) {
        this.logger.log(`${count} refresh tokens périmés purgés`);
      }
    } catch (error) {
      this.logger.error('Purge des refresh tokens échouée', error);
    }
  }
}
