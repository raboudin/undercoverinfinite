import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import type { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import type { OAuthProfile } from './auth.types';
import type { TokenService } from './token.service';
import { PUBLIC_USER_INCLUDE } from './user.mapper';

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
      delete: jest.Mock;
    };
    userAvatar: {
      upsert: jest.Mock;
      deleteMany: jest.Mock;
      findUnique: jest.Mock;
    };
    dailyUsage: { deleteMany: jest.Mock };
    contentDraw: { deleteMany: jest.Mock };
    $transaction: jest.Mock;
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
        delete: jest.fn(),
      },
      userAvatar: {
        upsert: jest.fn(),
        deleteMany: jest.fn(),
        findUnique: jest.fn(),
      },
      dailyUsage: { deleteMany: jest.fn() },
      contentDraw: { deleteMany: jest.fn() },
      // Les opérations sont passées telles quelles : ce qui compte ici est
      // *lesquelles* partent ensemble, pas ce que la base en renvoie.
      $transaction: jest.fn().mockResolvedValue([]),
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
        avatarUpdatedAt: null,
        hasPassword: true,
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
        include: PUBLIC_USER_INCLUDE,
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
        include: PUBLIC_USER_INCLUDE,
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
        include: PUBLIC_USER_INCLUDE,
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
        include: PUBLIC_USER_INCLUDE,
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

  describe('updateProfile', () => {
    beforeEach(() => {
      prisma.user.update.mockResolvedValue({
        id: 'user-1',
        email: 'agent@undercover.test',
        displayName: 'Corbeau',
      });
    });

    it('enregistre le nom de code sans ses espaces', async () => {
      const user = await service.updateProfile('user-1', {
        displayName: '  Corbeau  ',
      });

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: { displayName: 'Corbeau' },
        include: PUBLIC_USER_INCLUDE,
      });
      expect(user.displayName).toBe('Corbeau');
    });

    it('efface le nom de code sur une chaîne vide', async () => {
      // Sans quoi il n'y aurait aucun moyen de revenir à l'affichage par email.
      await service.updateProfile('user-1', { displayName: '   ' });

      expect(firstArg<{ data: unknown }>(prisma.user.update).data).toEqual({
        displayName: null,
      });
    });

    it('laisse le nom intact quand le champ est absent (sémantique PATCH)', async () => {
      await service.updateProfile('user-1', {});

      expect(firstArg<{ data: unknown }>(prisma.user.update).data).toEqual({});
    });
  });

  describe('avatar', () => {
    /** Plus petit PNG valide : en-tête magique suivi d'un peu de contenu. */
    const PNG_BYTES = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01,
    ]);
    const PNG_DATA_URL = `data:image/png;base64,${PNG_BYTES.toString('base64')}`;

    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'agent@undercover.test',
        displayName: 'Corbeau',
        avatar: { updatedAt: new Date('2026-08-04T10:00:00.000Z') },
      });
    });

    it('range les octets décodés et annonce la nouvelle date', async () => {
      const user = await service.setAvatar('user-1', PNG_DATA_URL);

      const call = firstArg<{
        create: { mimeType: string; data: Uint8Array };
      }>(prisma.userAvatar.upsert);
      expect(call.create.mimeType).toBe('image/png');
      expect(Buffer.from(call.create.data).equals(PNG_BYTES)).toBe(true);
      // C'est cette date que le front colle en `?v=` sur l'URL de la photo.
      expect(user.avatarUpdatedAt).toBe('2026-08-04T10:00:00.000Z');
    });

    it('refuse une image dont le contenu dément le type annoncé', async () => {
      await expect(
        service.setAvatar(
          'user-1',
          `data:image/png;base64,${Buffer.from('<script>').toString('base64')}`,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.userAvatar.upsert).not.toHaveBeenCalled();
    });

    it('retire la photo sans se plaindre s’il n’y en avait pas', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'agent@undercover.test',
        displayName: 'Corbeau',
        avatar: null,
      });

      const user = await service.removeAvatar('user-1');

      expect(prisma.userAvatar.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(user.avatarUpdatedAt).toBeNull();
    });

    it('sert les octets stockés pour l’affichage', async () => {
      prisma.userAvatar.findUnique.mockResolvedValue({
        userId: 'user-1',
        mimeType: 'image/webp',
        data: new Uint8Array(PNG_BYTES),
        updatedAt: new Date('2026-08-04T10:00:00.000Z'),
      });

      const avatar = await service.readAvatar('user-1');

      expect(avatar.mimeType).toBe('image/webp');
      expect(avatar.bytes.equals(PNG_BYTES)).toBe(true);
    });

    it('répond 404 pour un agent sans photo', async () => {
      prisma.userAvatar.findUnique.mockResolvedValue(null);

      await expect(service.readAvatar('user-1')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('deleteAccount', () => {
    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'agent@undercover.test',
        displayName: 'Corbeau',
        passwordHash,
      });
    });

    it('exige le mot de passe courant quand le compte en a un', async () => {
      // 403 et non 401 : la session est valable, c'est la re-authentification
      // qui échoue — un 401 ferait rejouer la requête au client après rotation.
      await expect(
        service.deleteAccount('user-1', { password: 'pas-le-bon' }),
      ).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.deleteAccount('user-1', {})).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('emporte le compte et les traces qui ne partent pas en cascade', async () => {
      await service.deleteAccount('user-1', { password: PASSWORD });

      // `daily_usage` et `content_draws` n'ont pas de clé étrangère vers
      // `users` : sans ces deux suppressions, la consommation et l'historique
      // de tirage survivraient à l'effacement du dossier.
      expect(prisma.dailyUsage.deleteMany).toHaveBeenCalledWith({
        where: { subject: 'user:user-1' },
      });
      expect(prisma.contentDraw.deleteMany).toHaveBeenCalledWith({
        where: { subject: 'user:user-1' },
      });
      expect(prisma.user.delete).toHaveBeenCalledWith({
        where: { id: 'user-1' },
      });
      // Le tout dans une seule transaction : un effacement à moitié fait
      // laisserait des traces orphelines qu'aucun compte ne réclamerait plus.
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(firstArg<unknown[]>(prisma.$transaction)).toHaveLength(3);
    });

    it('accepte la suppression d’un compte OAuth, qui n’a pas de mot de passe', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-oauth',
        email: 'agent@undercover.test',
        displayName: null,
        passwordHash: null,
      });

      await expect(
        service.deleteAccount('user-oauth', {}),
      ).resolves.toBeUndefined();
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });
  });
});
