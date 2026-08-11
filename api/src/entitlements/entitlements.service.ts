import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isUniqueViolation } from '../prisma/prisma.errors';
import {
  MODES,
  MODE_IDS,
  PACKS,
  THEMES,
  THEME_IDS,
  knownPacks,
  resolveAccess,
  type ModeDefinition,
  type ModeId,
  type PackDefinition,
  type PackId,
  type ThemeId,
} from './catalog';
import { nextDayKey, todayKey } from './day';
import type { Subject } from './subject';

export interface CreditsDto {
  /** Conservé pour l'affichage : n'est plus une borne réelle, voir `unlimited`. */
  dailyLimit: number;
  dailyUsed: number;
  dailyRemaining: number;
  /** Solde acheté, sans péremption. Toujours 0 sans compte. */
  wallet: number;
  /** Ce que le joueur peut réellement lancer maintenant. */
  remaining: number;
  unlimited: boolean;
  /** Date (Europe/Paris) de la prochaine remise à zéro. */
  resetsOn: string;
}

export interface EntitlementsDto {
  account: boolean;
  packs: PackId[];
  modes: ModeId[];
  themes: ThemeId[];
  credits: CreditsDto;
}

/** Thème exposé au client — sans le prompt, qui reste un détail serveur. */
export interface PublicThemeDto {
  id: ThemeId;
  label: string;
  tagline: string;
  generalist: boolean;
}

export interface CatalogDto {
  packs: PackDefinition[];
  modes: ModeDefinition[];
  themes: PublicThemeDto[];
  freeDailyCredits: number;
  unlimitedDailyCredits: number;
}

/** Quelle réserve a été débitée — la seule chose que sait rembourser `refundCredit`. */
export type CreditSource = 'daily' | 'wallet';

export interface CreditSpend {
  from: CreditSource;
  credits: CreditsDto;
}

@Injectable()
export class EntitlementsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Catalogue public : prix et contenus, identiques pour tout le monde. */
  catalog(): CatalogDto {
    return {
      packs: Object.values(PACKS),
      modes: MODE_IDS.map((id) => MODES[id]),
      themes: THEME_IDS.map((id) => ({
        id,
        label: THEMES[id].label,
        tagline: THEMES[id].tagline,
        generalist: THEMES[id].generalist,
      })),
      freeDailyCredits: resolveAccess({ hasAccount: false, packs: [] })
        .dailyLimit,
      unlimitedDailyCredits: resolveAccess({
        hasAccount: true,
        packs: ['unlimited'],
      }).dailyLimit,
    };
  }

  /**
   * Droits et crédits d'un sujet — la réponse de `GET /entitlements`. Plus de
   * plafond quotidien à consulter : `dailyUsed` reste à 0, `dailyRemaining`
   * vaut toujours `dailyLimit`. Le solde acheté reste affiché, lui, puisqu'un
   * pack de recharge continue de le créditer.
   */
  async resolve(subject: Subject): Promise<EntitlementsDto> {
    const packs = await this.packsOf(subject);
    const access = resolveAccess({ hasAccount: !!subject.userId, packs });

    const wallet = subject.userId
      ? await this.prisma.creditWallet.findUnique({
          where: { userId: subject.userId },
        })
      : null;
    const walletBalance = wallet?.balance ?? 0;

    return {
      account: !!subject.userId,
      packs,
      modes: access.modes,
      themes: access.themes,
      credits: {
        dailyLimit: access.dailyLimit,
        dailyUsed: 0,
        dailyRemaining: access.dailyLimit,
        wallet: walletBalance,
        remaining: access.dailyLimit + walletBalance,
        unlimited: access.unlimited,
        resetsOn: nextDayKey(todayKey()),
      },
    };
  }

  /**
   * Vérifie qu'un mode et un thème sont ouverts au sujet. Le contrôle vit ici
   * et pas seulement dans l'interface : sans lui, un `POST /words/draw` forgé
   * à la main servirait les thèmes payants à n'importe qui.
   */
  async assertCanPlay(
    subject: Subject,
    mode: ModeId,
    theme: ThemeId,
  ): Promise<void> {
    const packs = await this.packsOf(subject);
    const access = resolveAccess({ hasAccount: !!subject.userId, packs });

    if (!access.modes.includes(mode)) {
      throw new ForbiddenException(
        subject.userId
          ? `Le mode ${MODES[mode].label} demande un pack que ton dossier n'a pas encore.`
          : `Le mode ${MODES[mode].label} demande un compte d'agent.`,
      );
    }
    if (!MODES[mode].available) {
      throw new ForbiddenException(
        `Le mode ${MODES[mode].label} n'est pas encore ouvert.`,
      );
    }
    if (!access.themes.includes(theme)) {
      throw new ForbiddenException(
        `Le thème ${THEMES[theme].label} demande un pack Diamond ou Infinite.`,
      );
    }
  }

  /**
   * Sert une partie. Plus de plafond quotidien ni de solde à décrémenter :
   * `resolveAccess` renvoie désormais `unlimited: true` pour tout le monde, il
   * n'y a donc plus rien à débiter ni à comparer à une borne.
   */
  async consumeCredit(subject: Subject): Promise<CreditSpend> {
    return { from: 'daily', credits: (await this.resolve(subject)).credits };
  }

  /**
   * Rien n'est débité par `consumeCredit`, donc rien à rendre ici. Gardée pour
   * que `WordsService` n'ait pas besoin de changer de contrat si un échec de
   * tirage se produit en aval.
   */
  async refundCredit(_subject: Subject, _from: CreditSource): Promise<void> {}

  /**
   * Débloque un pack pour un compte. Gratuit aujourd'hui, d'où le déblocage
   * unique par pack : sans cette borne, un pack de recharge se reprendrait en
   * boucle et le plafond quotidien ne voudrait plus rien dire. Quand le
   * paiement arrivera, c'est cette contrainte qui devra porter la référence de
   * transaction plutôt que le seul couple (compte, pack).
   */
  async unlock(userId: string, pack: PackId): Promise<EntitlementsDto> {
    const definition = PACKS[pack];

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.entitlement.create({ data: { userId, pack } });
        if (definition.credits > 0) {
          await tx.creditWallet.upsert({
            where: { userId },
            create: { userId, balance: definition.credits },
            update: { balance: { increment: definition.credits } },
          });
        }
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          `Le pack ${definition.label} est déjà rattaché à ton dossier.`,
        );
      }
      throw error;
    }

    return this.resolve({ key: `user:${userId}`, userId });
  }

  private async packsOf(subject: Subject): Promise<PackId[]> {
    if (!subject.userId) return [];
    const rows = await this.prisma.entitlement.findMany({
      where: { userId: subject.userId },
      select: { pack: true },
    });
    return knownPacks(rows.map((row) => row.pack));
  }
}
