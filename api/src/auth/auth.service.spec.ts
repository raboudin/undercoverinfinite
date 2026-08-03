import { ConflictException, UnauthorizedException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import type { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import type { OAuthProfile } from './auth.types';
import type { TokenService } from './token.service';

const PASSWORD = 'motdepasse-solide';

/** Hash calculé une seule fois : bcrypt coût 12 est volontairement lent. */
let passwordHash: string;

/** Premier argument du n-ième appel d'un mock, typé. */
function firstArg<T>(mock: jest.Mock, call = 0): T {
  return (mock.mock.calls[call] as unknown[])[0] as T;
}

function googleProfile(overrides: Partial<OAuthProfile> = {}): OAuthProfile {
  return {
    provider: 'google',
    providerId: 'google-42',
    email: 'agent@undercover.test',
    emailVerified: true,
    displayName: 'Agent 42',
    ...overrides,
  };
}

describe('AuthService', () => {
  let prisma: {
    user: {
      create: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };
  let tokens: {
    issuePair: jest.Mock;
    rotate: jest.Mock;
    revoke: jest.Mock;
  };
  let service: AuthService;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(PASSWORD, 12);
  });

  beforeEach(() => {
    prisma = {
      user: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    tokens = {
      issuePair: jest
        .fn()
        .mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh' }),
      rotate: jest.fn(),
      revoke: jest.fn(),
    };
    service = new AuthService(
      prisma as unknown as PrismaService,
      tokens as unknown as TokenService,
    );
  });

  describe('register', () => {
    it('normalise l’email, hache le mot de passe et ouvre une session', async () => {
      prisma.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'agent@undercover.test',
        displayName: 'Agent 42',
        passwordHash: 'peu-importe',
      });

      const result = await service.register({
        email: '  Agent@Undercover.TEST ',
        password: PASSWORD,
        displayName: 'Agent 42',
      });

      const { data } = firstArg<{
        data: { email: string; passwordHash: string };
      }>(prisma.user.create);
      expect(data.email).toBe('agent@undercover.test');
      expect(data.passwordHash).not.toBe(PASSWORD);
      await expect(bcrypt.compare(PASSWORD, data.passwordHash)).resolves.toBe(
        true,
      );
      expect(result.user).toEqual({
        id: 'user-1',
        email: 'agent@undercover.test',
        displayName: 'Agent 42',
      });
      expect(result.tokens.refreshToken).toBe('refresh');
    });

    it('traduit la violation d’unicité en 409', async () => {
      prisma.user.create.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

      await expect(
        service.register({ email: 'pris@undercover.test', password: PASSWORD }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('laisse remonter les autres erreurs de base', async () => {
      prisma.user.create.mockRejectedValue(new Error('base HS'));

      await expect(
        service.register({ email: 'x@undercover.test', password: PASSWORD }),
      ).rejects.toThrow('base HS');
    });
  });

  describe('login', () => {
    it('ouvre une session avec le bon mot de passe', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'agent@undercover.test',
        displayName: null,
        passwordHash,
      });

      const result = await service.login({
        email: 'Agent@Undercover.test',
        password: PASSWORD,
      });

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'agent@undercover.test' },
      });
      expect(result.user.id).toBe('user-1');
      expect(tokens.issuePair).toHaveBeenCalledTimes(1);
    });

    it('refuse un mauvais mot de passe', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'agent@undercover.test',
        displayName: null,
        passwordHash,
      });

      await expect(
        service.login({ email: 'agent@undercover.test', password: 'à côté' }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(tokens.issuePair).not.toHaveBeenCalled();
    });

    it('refuse un email inconnu sans révéler qu’il est inconnu', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.login({ email: 'fantome@undercover.test', password: PASSWORD }),
      ).rejects.toThrow('Email ou mot de passe incorrect.');
    });

    it('refuse un compte OAuth qui n’a pas de mot de passe', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'agent@undercover.test',
        displayName: null,
        passwordHash: null,
      });

      await expect(
        service.login({ email: 'agent@undercover.test', password: PASSWORD }),
      ).rejects.toThrow('Email ou mot de passe incorrect.');
    });
  });

  describe('refresh / logout', () => {
    it('refuse un refresh sans cookie', async () => {
      await expect(service.refresh(undefined)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
      expect(tokens.rotate).not.toHaveBeenCalled();
    });

    it('délègue la rotation au TokenService', async () => {
      tokens.rotate.mockResolvedValue({ user: {}, tokens: {} });

      await service.refresh('un-refresh-token');

      expect(tokens.rotate).toHaveBeenCalledWith('un-refresh-token');
    });

    it('accepte un logout sans cookie', async () => {
      await expect(service.logout(undefined)).resolves.toBeUndefined();
      expect(tokens.revoke).not.toHaveBeenCalled();
    });
  });

  describe('loginWithOAuth', () => {
    it('connecte un compte déjà lié sans rien réécrire', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 'user-1',
        email: 'agent@undercover.test',
        displayName: 'Agent 42',
        passwordHash: null,
      });

      const result = await service.loginWithOAuth(googleProfile());

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { googleId: 'google-42' },
      });
      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(result.user.id).toBe('user-1');
    });

    it('crée le compte quand ni le fournisseur ni l’email ne sont connus', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-neuf',
        email: 'agent@undercover.test',
        displayName: 'Agent 42',
        passwordHash: null,
      });

      const result = await service.loginWithOAuth(googleProfile());

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'agent@undercover.test',
          displayName: 'Agent 42',
          googleId: 'google-42',
        },
      });
      expect(result.user.id).toBe('user-neuf');
    });

    it('lie le fournisseur à un compte existant de même email vérifié', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'agent@undercover.test',
        displayName: null,
        passwordHash: 'hash-existant',
      });
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        email: 'agent@undercover.test',
        displayName: 'Agent 42',
        passwordHash: 'hash-existant',
      });

      await service.loginWithOAuth(googleProfile());

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { googleId: 'google-42', displayName: 'Agent 42' },
      });
    });

    it('refuse de lier un compte sur un email non vérifié', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.loginWithOAuth(googleProfile({ emailVerified: false })),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.user.findUnique).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('refuse un profil sans email', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.loginWithOAuth(googleProfile({ email: null })),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('range le profil Facebook dans sa propre colonne', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-fb',
        email: 'agent@undercover.test',
        displayName: null,
        passwordHash: null,
      });

      await service.loginWithOAuth(
        googleProfile({
          provider: 'facebook',
          providerId: 'fb-7',
          displayName: null,
        }),
      );

      expect(prisma.user.findFirst).toHaveBeenCalledWith({
        where: { facebookId: 'fb-7' },
      });
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'agent@undercover.test',
          displayName: null,
          facebookId: 'fb-7',
        },
      });
    });

    it('rattrape la course de deux callbacks simultanés', async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      prisma.user.findUnique
        .mockResolvedValueOnce(null) // au moment du contrôle : pas de compte
        .mockResolvedValueOnce({
          // relecture après le conflit : l'autre requête vient de le créer
          id: 'user-1',
          email: 'agent@undercover.test',
          displayName: 'Agent 42',
          passwordHash: null,
        });
      prisma.user.create.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

      const result = await service.loginWithOAuth(googleProfile());

      expect(result.user.id).toBe('user-1');
    });
  });
});
