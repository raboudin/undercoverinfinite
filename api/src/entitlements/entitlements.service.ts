import {
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
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
import { dayDate, nextDayKey, todayKey } from './day';
import type { Subject } from './subject';

export interface CreditsDto {
  /** Quota du jour (5, ou 50 avec un pack illimité). */
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
  generalist: boolean;
}

export interface CatalogDto {
  packs: PackDefinition[];
  modes: ModeDefinition[];
  themes: PublicThemeDto[];
  freeDailyCredits: number;
  unlimitedDailyCredits: number;
}

/**
 * 402 : la requête est légitime, il ne reste simplement plus de crédit. Un 403
 * la confondrait avec « ce mode n'est pas débloqué », que le front doit traiter
 * autrement (proposer la boutique vs. proposer d'attendre demain).
 */
export class NoCreditsException extends HttpException {
  constructor(message: string) {
    super(message, HttpStatus.PAYMENT_REQUIRED);
  }
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

  /** Droits et crédits d'un sujet — la réponse de `GET /entitlements`. */
  async resolve(subject: Subject): Promise<EntitlementsDto> {
    const packs = await this.packsOf(subject);
    const access = resolveAccess({ hasAccount: !!subject.userId, packs });
    const day = todayKey();

    const [usage, wallet] = await Promise.all([
      this.prisma.dailyUsage.findUnique({
        where: { subject_day: { subject: subject.key, day: dayDate(day) } },
      }),
      subject.userId
        ? this.prisma.creditWallet.findUnique({
            where: { userId: subject.userId },
          })
        : null,
    ]);

    const dailyUsed = usage?.used ?? 0;
    const dailyRemaining = Math.max(access.dailyLimit - dailyUsed, 0);
    const walletBalance = wallet?.balance ?? 0;

    return {
      account: !!subject.userId,
      packs,
      modes: access.modes,
      themes: access.themes,
      credits: {
        dailyLimit: access.dailyLimit,
        dailyUsed,
        dailyRemaining,
        wallet: walletBalance,
        remaining: dailyRemaining + walletBalance,
        unlimited: access.unlimited,
        resetsOn: nextDayKey(day),
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
   * Débite une partie : le quota du jour d'abord, le solde acheté ensuite.
   *
   * Cet ordre est ce qui empêche une recharge de fondre en même temps que des
   * crédits gratuits — dépenser d'abord ce qui expire de toute façon ce soir.
   */
  async consumeCredit(subject: Subject): Promise<CreditSpend> {
    const packs = await this.packsOf(subject);
    const access = resolveAccess({ hasAccount: !!subject.userId, packs });
    const day = dayDate(todayKey());

    let from: CreditSource | null = null;
    if (await this.spendDaily(subject.key, day, access.dailyLimit)) {
      from = 'daily';
    } else if (subject.userId && (await this.spendWallet(subject.userId))) {
      from = 'wallet';
    }

    if (!from) {
      throw new NoCreditsException(
        subject.userId
          ? 'Tu as épuisé tes parties du jour. Elles reviennent à minuit, ou tout de suite avec une recharge.'
          : 'Tu as épuisé tes parties du jour. Elles reviennent à minuit — un compte d’agent en débloque davantage.',
      );
    }

    return { from, credits: (await this.resolve(subject)).credits };
  }

  /**
   * Rend le crédit débité quand la partie n'a finalement pas pu être servie
   * (LLM injoignable, par exemple). Le crédit est pris **avant** la génération
   * pour que la contrainte de quota reste atomique ; sans ce retour arrière,
   * une panne du fournisseur coûterait des parties au joueur.
   */
  async refundCredit(subject: Subject, from: CreditSource): Promise<void> {
    if (from === 'wallet' && subject.userId) {
      await this.prisma.creditWallet.updateMany({
        where: { userId: subject.userId },
        data: { balance: { increment: 1 } },
      });
      return;
    }
    // `used > 0` : un remboursement ne doit jamais créditer au-delà du quota,
    // par exemple si le compteur a été remis à zéro entre-temps (minuit).
    await this.prisma.dailyUsage.updateMany({
      where: {
        subject: subject.key,
        day: dayDate(todayKey()),
        used: { gt: 0 },
      },
      data: { used: { decrement: 1 } },
    });
  }

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

  /**
   * Incrémente le compteur du jour tant qu'il reste sous le plafond.
   *
   * `updateMany` avec la borne dans le `where` fait office de compare-and-swap :
   * deux parties lancées en même temps ne peuvent pas franchir le plafond
   * ensemble, là où un `findUnique` puis `update` le permettrait.
   */
  private async spendDaily(
    subject: string,
    day: Date,
    limit: number,
  ): Promise<boolean> {
    const bump = () =>
      this.prisma.dailyUsage.updateMany({
        where: { subject, day, used: { lt: limit } },
        data: { used: { increment: 1 } },
      });

    if ((await bump()).count > 0) return true;

    // Zéro ligne touchée : soit le plafond est atteint, soit il n'y a pas
    // encore de ligne pour aujourd'hui. Seul le second cas est rattrapable.
    const existing = await this.prisma.dailyUsage.findUnique({
      where: { subject_day: { subject, day } },
    });
    if (existing) return false;

    try {
      await this.prisma.dailyUsage.create({ data: { subject, day, used: 1 } });
      return true;
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      // Une requête concurrente a créé la ligne entre-temps : on rejoue le CAS.
      return (await bump()).count > 0;
    }
  }

  /** Même compare-and-swap sur le solde acheté : jamais de solde négatif. */
  private async spendWallet(userId: string): Promise<boolean> {
    const updated = await this.prisma.creditWallet.updateMany({
      where: { userId, balance: { gt: 0 } },
      data: { balance: { decrement: 1 } },
    });
    return updated.count > 0;
  }
}
