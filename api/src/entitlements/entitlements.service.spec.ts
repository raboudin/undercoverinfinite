import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { PrismaService } from '../prisma/prisma.service';
import { UNLIMITED_DAILY_CREDITS } from './catalog';
import { EntitlementsService } from './entitlements.service';
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
    it('rend des crédits illimités et aucun pack à un anonyme', async () => {
      const result = await service.resolve(ANON);

      expect(result.account).toBe(false);
      expect(result.packs).toEqual([]);
      expect(result.credits.unlimited).toBe(true);
      expect(result.credits.dailyUsed).toBe(0);
      // Aucune lecture de portefeuille sans compte : il n'y en a pas.
      expect(prisma.creditWallet.findUnique).not.toHaveBeenCalled();
    });

    it('ajoute le solde acheté au quota, désormais toujours illimité', async () => {
      prisma.creditWallet.findUnique.mockResolvedValue({ balance: 7 });

      const result = await service.resolve(ACCOUNT);

      expect(result.credits.wallet).toBe(7);
      expect(result.credits.remaining).toBe(
        UNLIMITED_DAILY_CREDITS + 7,
      );
    });

    it('reste illimité même sans aucun pack', async () => {
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
    it('sert toujours la partie, sans jamais toucher le portefeuille', async () => {
      const spend = await service.consumeCredit(ACCOUNT);

      expect(spend.from).toBe('daily');
      expect(spend.credits.unlimited).toBe(true);
      expect(prisma.creditWallet.updateMany).not.toHaveBeenCalled();
    });

    it('sert aussi un anonyme sans jamais le bloquer', async () => {
      const spend = await service.consumeCredit(ANON);

      expect(spend.from).toBe('daily');
      expect(spend.credits.remaining).toBeGreaterThan(0);
    });
  });

  describe('refundCredit', () => {
    it('ne touche plus rien : rien n’a été débité par consumeCredit', async () => {
      await service.refundCredit(ANON, 'daily');
      await service.refundCredit(ACCOUNT, 'wallet');

      expect(prisma.creditWallet.updateMany).not.toHaveBeenCalled();
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
