import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { userSubject } from '../entitlements/subject';
import { PrismaService } from '../prisma/prisma.service';
import { isUniqueViolation } from '../prisma/prisma.errors';
import { parseAvatarDataUrl, type AvatarMimeType } from './avatar';
import type {
  AuthResult,
  OAuthProfile,
  OAuthProviderName,
  PublicUser,
} from './auth.types';
import type { DeleteAccountDto } from './dto/delete-account.dto';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type { UpdateProfileDto } from './dto/update-profile.dto';
import { TokenService } from './token.service';
import {
  PUBLIC_USER_INCLUDE,
  toPublicUser,
  type PublicUserRow,
} from './user.mapper';

/** Coût bcrypt. 12 ≈ 250 ms sur un CPU serveur courant en 2026. */
const BCRYPT_ROUNDS = 12;

/** Forme minimale de la ligne `users` dont ce service a besoin. */
interface UserRow extends PublicUserRow {
  passwordHash: string | null;
}

/** Photo de profil telle que servie par `GET /auth/avatar/:userId`. */
export interface AvatarPayload {
  mimeType: AvatarMimeType;
  bytes: Buffer;
  updatedAt: Date;
}

let dummyHashPromise: Promise<string> | null = null;

/**
 * Hash bidon comparé quand l'email n'existe pas, pour que la réponse coûte le
 * même temps qu'avec un compte réel : sans ça, la latence de `/auth/login`
 * dit à l'attaquant quels emails sont inscrits.
 */
function dummyHash(): Promise<string> {
  dummyHashPromise ??= bcrypt.hash('compte-inexistant', BCRYPT_ROUNDS);
  return dummyHashPromise;
}

/** Les emails sont comparés et stockés en minuscules, sans espaces autour. */
function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const email = normalizeEmail(dto.email);
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    try {
      // Pas de `findUnique` préalable : la contrainte unique tranche seule, et
      // sans fenêtre de course entre la vérification et l'insertion.
      const user = await this.prisma.user.create({
        data: { email, passwordHash, displayName: dto.displayName ?? null },
      });
      return this.issueFor(user);
    } catch (error) {
      if (isUniqueViolation(error)) {
        // L'inscription révèle forcément qu'un email est pris — c'est
        // inhérent au formulaire. `/auth/login` reste, lui, muet là-dessus.
        throw new ConflictException('Un compte existe déjà avec cet email.');
      }
      throw error;
    }
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const email = normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: PUBLIC_USER_INCLUDE,
    });

    // `passwordHash` nul = compte créé par OAuth seul. Le message reste
    // volontairement identique dans les trois cas (email inconnu, compte sans
    // mot de passe, mot de passe faux) pour ne rien apprendre à un attaquant.
    if (!user?.passwordHash) {
      await bcrypt.compare(dto.password, await dummyHash());
      throw new UnauthorizedException('Email ou mot de passe incorrect.');
    }

    if (!(await bcrypt.compare(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Email ou mot de passe incorrect.');
    }

    return this.issueFor(user);
  }

  async refresh(refreshToken: string | undefined): Promise<AuthResult> {
    if (!refreshToken) {
      throw new UnauthorizedException('Aucune session à rafraîchir.');
    }
    return this.tokens.rotate(refreshToken);
  }

  async logout(refreshToken: string | undefined): Promise<void> {
    if (!refreshToken) return;
    await this.tokens.revoke(refreshToken);
  }

  /**
   * Connexion par fournisseur externe. Trois cas :
   *   1. le fournisseur est déjà lié à un compte → on le connecte ;
   *   2. l'email correspond à un compte existant → on lie le fournisseur ;
   *   3. rien ne correspond → on crée le compte.
   *
   * Le cas 2 n'est autorisé qu'avec un email vérifié par le fournisseur :
   * sinon, quiconque peut créer un compte Google affichant l'email d'un tiers
   * s'emparerait de son compte de jeu.
   */
  async loginWithOAuth(profile: OAuthProfile): Promise<AuthResult> {
    const linked = await this.prisma.user.findFirst({
      where: this.providerFilter(profile.provider, profile.providerId),
      include: PUBLIC_USER_INCLUDE,
    });
    if (linked) return this.issueFor(linked);

    if (!profile.email) {
      throw new UnauthorizedException(
        `Ce compte ${profile.provider} ne fournit pas d'adresse email : impossible de créer ton profil.`,
      );
    }
    if (!profile.emailVerified) {
      throw new UnauthorizedException(
        `L'adresse email de ce compte ${profile.provider} n'est pas vérifiée.`,
      );
    }

    const email = normalizeEmail(profile.email);
    const existing = await this.prisma.user.findUnique({ where: { email } });

    if (existing) {
      const user = await this.prisma.user.update({
        where: { id: existing.id },
        data: {
          ...this.providerFilter(profile.provider, profile.providerId),
          displayName: existing.displayName ?? profile.displayName,
        },
        include: PUBLIC_USER_INCLUDE,
      });
      this.logger.log(`${profile.provider} lié au compte ${user.id}`);
      return this.issueFor(user);
    }

    try {
      const user = await this.prisma.user.create({
        data: {
          email,
          displayName: profile.displayName,
          ...this.providerFilter(profile.provider, profile.providerId),
        },
      });
      return this.issueFor(user);
    } catch (error) {
      if (isUniqueViolation(error)) {
        // Course entre deux callbacks du même utilisateur : le compte vient
        // d'être créé par l'autre requête, on le rejoue en lecture.
        const user = await this.prisma.user.findUnique({
          where: { email },
          include: PUBLIC_USER_INCLUDE,
        });
        if (user) return this.issueFor(user);
      }
      throw error;
    }
  }

  /**
   * Met à jour le dossier d'agent. Un champ absent du corps reste inchangé
   * (sémantique PATCH) ; un nom de code vide l'efface, le compte retombant
   * alors sur la partie locale de son email pour s'afficher.
   */
  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
  ): Promise<PublicUser> {
    const data: { displayName?: string | null } = {};
    if (dto.displayName !== undefined) {
      const trimmed = dto.displayName.trim();
      data.displayName = trimmed.length > 0 ? trimmed : null;
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      include: PUBLIC_USER_INCLUDE,
    });
    return toPublicUser(user);
  }

  /**
   * Remplace la photo de profil. `upsert` plutôt que create/update : reposer
   * une photo est le geste courant, et `updatedAt` change à chaque fois — c'est
   * lui qui invalide l'URL en cache côté navigateur.
   */
  async setAvatar(userId: string, dataUrl: string): Promise<PublicUser> {
    const { mimeType, bytes } = parseAvatarDataUrl(dataUrl);
    // Les colonnes `Bytes` de Prisma 7 attendent un `Uint8Array` adossé à un
    // vrai `ArrayBuffer` ; le `Buffer` de Node est typé sur `ArrayBufferLike`,
    // que TypeScript refuse ici. La copie porte sur 64 Kio au plus.
    const data = new Uint8Array(bytes);

    await this.prisma.userAvatar.upsert({
      where: { userId },
      create: { userId, mimeType, data },
      update: { mimeType, data },
    });

    return this.publicUser(userId);
  }

  /** Retire la photo. `deleteMany` : effacer deux fois n'est pas une erreur. */
  async removeAvatar(userId: string): Promise<PublicUser> {
    await this.prisma.userAvatar.deleteMany({ where: { userId } });
    return this.publicUser(userId);
  }

  async readAvatar(userId: string): Promise<AvatarPayload> {
    const avatar = await this.prisma.userAvatar.findUnique({
      where: { userId },
    });
    if (!avatar) {
      throw new NotFoundException("Cet agent n'a pas de photo.");
    }
    return {
      // Le type a été validé à l'écriture (`parseAvatarDataUrl`) : rien
      // d'autre que les trois formats acceptés n'a pu entrer en base.
      mimeType: avatar.mimeType as AvatarMimeType,
      // Prisma rend les `Bytes` en `Uint8Array` ; Express veut un Buffer.
      bytes: Buffer.from(avatar.data),
      updatedAt: avatar.updatedAt,
    };
  }

  /**
   * Suppression du compte (RGPD, droit à l'effacement). Irréversible.
   *
   * Le mot de passe est réexigé quand le compte en a un : une session laissée
   * ouverte ne doit pas suffire à effacer le dossier. Un compte né d'un OAuth
   * n'en a pas — la session y fait seule autorité.
   */
  async deleteAccount(userId: string, dto: DeleteAccountDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('Compte introuvable.');
    }

    if (user.passwordHash) {
      const ok =
        !!dto.password &&
        (await bcrypt.compare(dto.password, user.passwordHash));
      if (!ok) {
        // 403 et non 401 : la session est parfaitement valable, c'est la
        // re-authentification qui échoue. Un 401 déclencherait côté front la
        // rotation du refresh token puis le rejeu de la requête — donc un
        // second envoi du mauvais mot de passe pour rien.
        throw new ForbiddenException(
          'Mot de passe incorrect : le dossier n’a pas été supprimé.',
        );
      }
    }

    const subject = userSubject(userId).key;

    // `daily_usage` et `content_draws` ne portent pas de clé étrangère vers
    // `users` — leur colonne `subject` couvre aussi les appareils anonymes — et
    // la cascade ne les emporte donc pas. Il faut les nommer, sinon la
    // consommation et l'historique de tirage du compte survivraient à son
    // effacement. Le reste (sessions, packs, portefeuille, photo) part en
    // cascade depuis `users`.
    await this.prisma.$transaction([
      this.prisma.dailyUsage.deleteMany({ where: { subject } }),
      this.prisma.contentDraw.deleteMany({ where: { subject } }),
      this.prisma.user.delete({ where: { id: userId } }),
    ]);

    this.logger.log(
      `Dossier ${userId} supprimé à la demande de son titulaire.`,
    );
  }

  /** Relit l'utilisateur avec sa photo, après une écriture sur celle-ci. */
  private async publicUser(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: PUBLIC_USER_INCLUDE,
    });
    if (!user) {
      throw new UnauthorizedException('Compte introuvable.');
    }
    return toPublicUser(user);
  }

  /** Filtre/données de la colonne d'identité du fournisseur. */
  private providerFilter(
    provider: OAuthProviderName,
    providerId: string,
  ): { googleId: string } | { facebookId: string } {
    return provider === 'google'
      ? { googleId: providerId }
      : { facebookId: providerId };
  }

  private async issueFor(user: UserRow): Promise<AuthResult> {
    const publicUser = toPublicUser(user);
    return {
      user: publicUser,
      tokens: await this.tokens.issuePair(publicUser),
    };
  }
}
