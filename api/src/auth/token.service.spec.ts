import { UnauthorizedException } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import { createHash } from 'node:crypto';
import type { PrismaService } from '../prisma/prisma.service';
import type { AuthConfig } from './auth.config';
import type { PublicUser } from './auth.types';
import { TokenService } from './token.service';
import { PUBLIC_USER_INCLUDE } from './user.mapper';

const CONFIG: AuthConfig = {
  jwtSecret: 'secret-de-test',
  accessTokenTtlSeconds: 5 * 3600,
  refreshTokenTtlSeconds: 30 * 86400,
  cookie: { secure: false, sameSite: 'strict' },
  oauth: {
    google: null,
    facebook: null,
    successRedirect: 'http://localhost:3000',
    failureRedirect: 'http://localhost:3000',
  },
};

const USER: PublicUser = {
  id: 'user-1',
  email: 'agent@undercover.test',
  displayName: null,
  avatarUpdatedAt: null,
  hasPassword: false,
};

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/** `expect.any` renvoie un `any` : on le range en `unknown` pour le linter. */
const ANY_DATE: unknown = expect.any(Date);

/** Premier argument du n-ième appel d'un mock, typé. */
function firstArg<T>(mock: jest.Mock, call = 0): T {
  return (mock.mock.calls[call] as unknown[])[0] as T;
}

/** Ligne `refresh_tokens` vivante par défaut. */
function tokenRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'token-1',
    userId: USER.id,
    tokenHash: 'peu-importe',
    expiresAt: new Date(Date.now() + 86400_000),
    revokedAt: null,
    createdAt: new Date(),
    user: { ...USER },
    ...overrides,
  };
}

describe('TokenService', () => {
  let prisma: {
    refreshToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
      deleteMany: jest.Mock;
    };
  };
  let jwt: { signAsync: jest.Mock };
  let service: TokenService;

  beforeEach(() => {
    prisma = {
      refreshToken: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    jwt = { signAsync: jest.fn().mockResolvedValue('access.jwt.signe') };
    service = new TokenService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
      CONFIG,
    );
  });

  describe('issuePair', () => {
    it('ne stocke que le SHA-256 du refresh token', async () => {
      const { accessToken, refreshToken } = await service.issuePair(USER);

      expect(accessToken).toBe('access.jwt.signe');
      const { data } = firstArg<{
        data: { tokenHash: string; userId: string; expiresAt: Date };
      }>(prisma.refreshToken.create);
      expect(data.tokenHash).toBe(sha256(refreshToken));
      expect(data.tokenHash).not.toBe(refreshToken);
      expect(data.userId).toBe(USER.id);
    });

    it('signe un access token portant id et email', async () => {
      await service.issuePair(USER);

      expect(jwt.signAsync).toHaveBeenCalledWith({
        sub: USER.id,
        email: USER.email,
      });
    });

    it('date l’expiration du refresh token depuis la config', async () => {
      const before = Date.now();
      await service.issuePair(USER);

      const { data } = firstArg<{ data: { expiresAt: Date } }>(
        prisma.refreshToken.create,
      );
      const expectedMs = CONFIG.refreshTokenTtlSeconds * 1000;
      expect(data.expiresAt.getTime()).toBeGreaterThanOrEqual(
        before + expectedMs,
      );
      expect(data.expiresAt.getTime()).toBeLessThanOrEqual(
        Date.now() + expectedMs,
      );
    });

    it('tire un refresh token différent à chaque émission', async () => {
      const first = await service.issuePair(USER);
      const second = await service.issuePair(USER);

      expect(first.refreshToken).not.toBe(second.refreshToken);
    });
  });

  describe('rotate', () => {
    it('révoque le token présenté et en émet une paire neuve', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(tokenRow());

      const result = await service.rotate('ancien-token');

      expect(prisma.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash: sha256('ancien-token') },
        include: { user: { include: PUBLIC_USER_INCLUDE } },
      });
      // Révocation conditionnelle : c'est ce `revokedAt: null` qui empêche
      // deux rotations concurrentes de réussir toutes les deux.
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { id: 'token-1', revokedAt: null },
        data: { revokedAt: ANY_DATE },
      });
      expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
      expect(result.user.id).toBe(USER.id);
      expect(result.tokens.refreshToken).toEqual(expect.any(String));
    });

    it('rejette un token inconnu', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(null);

      await expect(service.rotate('inconnu')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('rejette un token expiré sans toucher aux autres sessions', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(
        tokenRow({ expiresAt: new Date(Date.now() - 1000) }),
      );

      await expect(service.rotate('perime')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
    });

    it('coupe toutes les sessions quand un token déjà consommé est rejoué', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(
        tokenRow({ revokedAt: new Date() }),
      );

      await expect(service.rotate('rejoue')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: USER.id, revokedAt: null },
        data: { revokedAt: ANY_DATE },
      });
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('traite une rotation concurrente perdue comme un rejeu', async () => {
      prisma.refreshToken.findUnique.mockResolvedValue(tokenRow());
      // 0 ligne mise à jour = quelqu'un d'autre a consommé le token entre le
      // findUnique et l'update.
      prisma.refreshToken.updateMany.mockResolvedValueOnce({ count: 0 });

      await expect(service.rotate('course')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(prisma.refreshToken.updateMany).toHaveBeenLastCalledWith({
        where: { userId: USER.id, revokedAt: null },
        data: { revokedAt: ANY_DATE },
      });
      expect(prisma.refreshToken.create).not.toHaveBeenCalled();
    });
  });

  describe('revoke', () => {
    it('ne révoque que la ligne encore vivante du token présenté', async () => {
      await service.revoke('mon-token');

      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { tokenHash: sha256('mon-token'), revokedAt: null },
        data: { revokedAt: ANY_DATE },
      });
    });

    it('reste silencieux sur un token inconnu', async () => {
      prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.revoke('inconnu')).resolves.toBeUndefined();
    });
  });

  describe('purgeExpiredTokens', () => {
    it('avale les erreurs plutôt que de faire tomber le cron', async () => {
      prisma.refreshToken.deleteMany.mockRejectedValue(new Error('base HS'));

      await expect(service.purgeExpiredTokens()).resolves.toBeUndefined();
    });
  });
});
