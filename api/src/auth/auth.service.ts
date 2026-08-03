import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { isUniqueViolation } from '../prisma/prisma.errors';
import type {
  AuthResult,
  OAuthProfile,
  OAuthProviderName,
  PublicUser,
} from './auth.types';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import { TokenService } from './token.service';

/** Coût bcrypt. 12 ≈ 250 ms sur un CPU serveur courant en 2026. */
const BCRYPT_ROUNDS = 12;

/** Forme minimale de la ligne `users` dont ce service a besoin. */
interface UserRow {
  id: string;
  email: string;
  displayName: string | null;
  passwordHash: string | null;
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

function toPublicUser(user: UserRow): PublicUser {
  return { id: user.id, email: user.email, displayName: user.displayName };
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
    const user = await this.prisma.user.findUnique({ where: { email } });

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
        const user = await this.prisma.user.findUnique({ where: { email } });
        if (user) return this.issueFor(user);
      }
      throw error;
    }
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
