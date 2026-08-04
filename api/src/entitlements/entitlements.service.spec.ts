import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { FREE_DAILY_CREDITS, UNLIMITED_DAILY_CREDITS } from './catalog';
import { dayDate, todayKey } from './day';
import {
  EntitlementsService,
  NoCreditsException,
} from './entitlements.service';
import { userSubject, type Subject } from './subject';

const ANON: Subject = { key: 'device:abc', userId: null };
const ACCOUNT = userSubject('user-1');

/** P2002 tel que Prisma le lève sur une contrainte unique. */
function uniqueViolation() {
  return Object.assign(new Error('unique'), { code: 'P2002' });
}

describe('EntitlementsService', () => {
  let prisma: {
    entitlement: { findMany: jest.Mock; create: jest.Mock };
    dailyUsage: {
      findUnique: jest.Mock;
      updateMany: jest.Mock;
      create: jest.Mock;
    };
    creditWallet: {
      findUnique: jest.Mock;
      updateMany: jest.Mock;
      upsert: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let service: EntitlementsService;

  beforeEach(() => {
    prisma = {
      entitlement: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn(),
      },
      dailyUsage: {
        findUnique: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({}),
      },
      creditWallet: {
        findUnique: jest.fn().mockResolvedValue(null),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        upsert: jest.fn(),
      },
      $transaction: jest.fn(),
    };
    service = new EntitlementsService(prisma as unknown as PrismaService);
  });

  /** Le compte détient les packs donnés. */
  function ownsPacks(...packs: string[]) {
    prisma.entitlement.findMany.mockResolvedValue(
      packs.map((pack) => ({ pack })),
    );
  }

  describe('resolve', () => {
    it('rend le quota gratuit et aucun pack à un anonyme', async () => {
      const result = await service.resolve(ANON);

      expect(result.account).toBe(false);
      expect(result.packs).toEqual([]);
      expect(result.credits.dailyLimit).toBe(FREE_DAILY_CREDITS);
      expect(result.credits.remaining).toBe(FREE_DAILY_CREDITS);
      // Aucune lecture de portefeuille sans compte : il n'y en a pas.
      expect(prisma.creditWallet.findUnique).not.toHaveBeenCalled();
    });

    it('déduit la consommation du jour et ajoute le solde acheté', async () => {
      prisma.dailyUsage.findUnique.mockResolvedValue({ used: 3 });
      prisma.creditWallet.findUnique.mockResolvedValue({ balance: 7 });

      const result = await service.resolve(ACCOUNT);

      expect(result.credits.dailyUsed).toBe(3);
      expect(result.credits.dailyRemaining).toBe(FREE_DAILY_CREDITS - 3);
      expect(result.credits.wallet).toBe(7);
      expect(result.credits.remaining).toBe(FREE_DAILY_CREDITS - 3 + 7);
    });

    it('relève le plafond avec un pack illimité', async () => {
      ownsPacks('infinite');

      const result = await service.resolve(ACCOUNT);

      expect(result.credits.dailyLimit).toBe(UNLIMITED_DAILY_CREDITS);
      expect(result.credits.unlimited).toBe(true);
    });

    it('annonce la remise à zéro au lendemain', async () => {
      const result = await service.resolve(ANON);

      expect(result.credits.resetsOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('assertCanPlay', () => {
    it('laisse passer le mode classique d’un anonyme', async () => {
      await expect(
        service.assertCanPlay(ANON, 'classique', 'general'),
      ).resolves.toBeUndefined();
    });

    it('refuse le chrono sans compte', async () => {
      await expect(
        service.assertCanPlay(ANON, 'chrono', 'general'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('refuse un thème premium à un compte sans pack', async () => {
      await expect(
        service.assertCanPlay(ACCOUNT, 'classique', 'football'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('ouvre les thèmes premium avec diamond', async () => {
      ownsPacks('diamond');

      await expect(
        service.assertCanPlay(ACCOUNT, 'defi', 'football'),
      ).resolves.toBeUndefined();
    });

    it('refuse teams même à infinite tant que les règles n’existent pas', async () => {
      ownsPacks('infinite');

      await expect(
        service.assertCanPlay(ACCOUNT, 'teams', 'general'),
      ).rejects.toThrow(/pas encore ouvert/);
    });
  });

  describe('consumeCredit', () => {
    it('débite le quota du jour en priorité', async () => {
      prisma.dailyUsage.updateMany.mockResolvedValue({ count: 1 });
      prisma.creditWallet.findUnique.mockResolvedValue({ balance: 5 });

      const spend = await service.consumeCredit(ACCOUNT);

      expect(spend.from).toBe('daily');
      // Le solde acheté ne doit pas fondre tant qu'il reste du gratuit.
      expect(prisma.creditWallet.updateMany).not.toHaveBeenCalled();
    });

    it('crée la ligne du jour au premier crédit', async () => {
      prisma.dailyUsage.updateMany.mockResolvedValue({ count: 0 });
      prisma.dailyUsage.findUnique.mockResolvedValue(null);

      const spend = await service.consumeCredit(ANON);

      expect(spend.from).toBe('daily');
      expect(prisma.dailyUsage.create).toHaveBeenCalledWith({
        data: { subject: 'device:abc', day: dayDate(todayKey()), used: 1 },
      });
    });

    it('bascule sur le solde acheté quand le quota est épuisé', async () => {
      prisma.dailyUsage.updateMany.mockResolvedValue({ count: 0 });
      prisma.dailyUsage.findUnique.mockResolvedValue({
        used: FREE_DAILY_CREDITS,
      });
      prisma.creditWallet.updateMany.mockResolvedValue({ count: 1 });

      const spend = await service.consumeCredit(ACCOUNT);

      expect(spend.from).toBe('wallet');
      expect(prisma.creditWallet.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', balance: { gt: 0 } },
        data: { balance: { decrement: 1 } },
      });
    });

    it('répond 402 quand quota et solde sont vides', async () => {
      prisma.dailyUsage.updateMany.mockResolvedValue({ count: 0 });
      prisma.dailyUsage.findUnique.mockResolvedValue({
        used: FREE_DAILY_CREDITS,
      });
      prisma.creditWallet.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.consumeCredit(ACCOUNT)).rejects.toThrow(
        NoCreditsException,
      );
    });

    it('n’essaie pas le portefeuille d’un anonyme', async () => {
      prisma.dailyUsage.updateMany.mockResolvedValue({ count: 0 });
      prisma.dailyUsage.findUnique.mockResolvedValue({
        used: FREE_DAILY_CREDITS,
      });

      await expect(service.consumeCredit(ANON)).rejects.toThrow(
        NoCreditsException,
      );
      expect(prisma.creditWallet.updateMany).not.toHaveBeenCalled();
    });

    it('rejoue le compare-and-swap si une requête concurrente a créé la ligne', async () => {
      prisma.dailyUsage.updateMany
        .mockResolvedValueOnce({ count: 0 }) // pas de ligne encore
        .mockResolvedValueOnce({ count: 1 }); // rejoué après la course
      prisma.dailyUsage.findUnique.mockResolvedValue(null);
      prisma.dailyUsage.create.mockRejectedValue(uniqueViolation());

      const spend = await service.consumeCredit(ANON);

      expect(spend.from).toBe('daily');
      expect(prisma.dailyUsage.updateMany).toHaveBeenCalledTimes(2);
    });
  });

  describe('refundCredit', () => {
    it('rend un crédit quotidien sans jamais passer sous zéro', async () => {
      await service.refundCredit(ANON, 'daily');

      expect(prisma.dailyUsage.updateMany).toHaveBeenCalledWith({
        where: {
          subject: 'device:abc',
          day: dayDate(todayKey()),
          used: { gt: 0 },
        },
        data: { used: { decrement: 1 } },
      });
    });

    it('recrédite le portefeuille', async () => {
      await service.refundCredit(ACCOUNT, 'wallet');

      expect(prisma.creditWallet.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { balance: { increment: 1 } },
      });
    });
  });

  describe('unlock', () => {
    /** Exécute le callback de transaction sur le mock prisma. */
    function runTransaction() {
      prisma.$transaction.mockImplementation(
        (fn: (tx: unknown) => Promise<unknown>) => fn(prisma),
      );
    }

    it('crédite le portefeuille pour un pack de recharge', async () => {
      runTransaction();
      prisma.entitlement.create.mockResolvedValue({});

      await service.unlock('user-1', 'credits20');

      expect(prisma.creditWallet.upsert).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        create: { userId: 'user-1', balance: 20 },
        update: { balance: { increment: 20 } },
      });
    });

    it('ne touche pas au portefeuille pour un pack de modes', async () => {
      runTransaction();
      prisma.entitlement.create.mockResolvedValue({});

      await service.unlock('user-1', 'diamond');

      expect(prisma.creditWallet.upsert).not.toHaveBeenCalled();
    });

    it('refuse un second déblocage du même pack', async () => {
      runTransaction();
      prisma.entitlement.create.mockRejectedValue(uniqueViolation());

      await expect(service.unlock('user-1', 'credits20')).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
