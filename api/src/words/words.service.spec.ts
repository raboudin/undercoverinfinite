import { ForbiddenException } from '@nestjs/common';
import type {
  CreditsDto,
  EntitlementsService,
} from '../entitlements/entitlements.service';
import type { Subject } from '../entitlements/subject';
import type { PrismaService } from '../prisma/prisma.service';
import type { LlmClient } from './llm.client';
import { WordsService } from './words.service';

const SUBJECT: Subject = { key: 'device:abc', userId: null };

const CREDITS: CreditsDto = {
  dailyLimit: 5,
  dailyUsed: 1,
  dailyRemaining: 4,
  wallet: 0,
  remaining: 4,
  unlimited: false,
  resetsOn: '2026-08-04',
};

const GENERATED = [
  { a: 'Café', b: 'Thé' },
  { a: 'Avion', b: 'Hélicoptère' },
];

function pairRow(id: string, a: string, b: string) {
  return {
    id,
    theme: 'general',
    spicy: false,
    wordA: a,
    wordB: b,
    createdAt: new Date(),
  };
}

describe('WordsService', () => {
  let prisma: {
    wordPair: { count: jest.Mock; findMany: jest.Mock; createMany: jest.Mock };
    challenge: { count: jest.Mock; findMany: jest.Mock; createMany: jest.Mock };
    contentDraw: { findMany: jest.Mock; create: jest.Mock };
  };
  let entitlements: {
    assertCanPlay: jest.Mock;
    consumeCredit: jest.Mock;
    refundCredit: jest.Mock;
  };
  let llm: { complete: jest.Mock };
  let service: WordsService;

  beforeEach(() => {
    prisma = {
      wordPair: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest.fn().mockResolvedValue([pairRow('p1', 'Café', 'Thé')]),
        createMany: jest.fn().mockResolvedValue({ count: GENERATED.length }),
      },
      challenge: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: 'c1', text: 'Parle à la troisième personne' },
          ]),
        createMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      contentDraw: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    entitlements = {
      assertCanPlay: jest.fn().mockResolvedValue(undefined),
      consumeCredit: jest
        .fn()
        .mockResolvedValue({ from: 'daily', credits: CREDITS }),
      refundCredit: jest.fn().mockResolvedValue(undefined),
    };
    llm = { complete: jest.fn().mockResolvedValue(JSON.stringify(GENERATED)) };

    service = new WordsService(
      prisma as unknown as PrismaService,
      entitlements as unknown as EntitlementsService,
      llm as unknown as LlmClient,
    );
  });

  /** Prompt envoyé au LLM lors de la première génération. */
  function firstPrompt(): string {
    const calls = llm.complete.mock.calls as string[][];
    return calls[0]?.[0] ?? '';
  }

  /** Pool vide au premier comptage, rempli au second (après génération). */
  function emptyPoolThenFilled() {
    prisma.wordPair.count.mockResolvedValueOnce(0).mockResolvedValue(1);
  }

  it('sert une paire du pool sans appeler le LLM quand il en reste', async () => {
    const result = await service.draw(SUBJECT, 'classique', 'general');

    expect(result.pair).toEqual({ a: 'Café', b: 'Thé' });
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it('vérifie les droits avant de débiter quoi que ce soit', async () => {
    entitlements.assertCanPlay.mockRejectedValue(new ForbiddenException('non'));

    await expect(service.draw(SUBJECT, 'hot', 'general')).rejects.toThrow(
      ForbiddenException,
    );
    expect(entitlements.consumeCredit).not.toHaveBeenCalled();
  });

  it('note le tirage pour ne pas resservir la même paire', async () => {
    await service.draw(SUBJECT, 'classique', 'general');

    expect(prisma.contentDraw.create).toHaveBeenCalledWith({
      data: { subject: 'device:abc', kind: 'pair', refId: 'p1' },
    });
  });

  it('exclut du tirage ce que le sujet a déjà vu', async () => {
    prisma.contentDraw.findMany.mockResolvedValue([{ refId: 'p0' }]);

    await service.draw(SUBJECT, 'classique', 'general');

    expect(prisma.wordPair.count).toHaveBeenCalledWith({
      where: { theme: 'general', spicy: false, id: { notIn: ['p0'] } },
    });
  });

  it('génère un lot quand le pool n’a plus rien d’inédit', async () => {
    emptyPoolThenFilled();

    await service.draw(SUBJECT, 'classique', 'general');

    expect(llm.complete).toHaveBeenCalledTimes(1);
    expect(prisma.wordPair.createMany).toHaveBeenCalledWith({
      data: [
        { theme: 'general', spicy: false, wordA: 'Café', wordB: 'Thé' },
        {
          theme: 'general',
          spicy: false,
          wordA: 'Avion',
          wordB: 'Hélicoptère',
        },
      ],
      skipDuplicates: true,
    });
  });

  it('ne déclenche qu’une génération pour deux parties simultanées', async () => {
    prisma.wordPair.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    prisma.wordPair.count.mockResolvedValue(1);
    let release: () => void = () => {};
    llm.complete.mockReturnValue(
      new Promise<string>((resolve) => {
        release = () => resolve(JSON.stringify(GENERATED));
      }),
    );

    const both = Promise.all([
      service.draw(SUBJECT, 'classique', 'general'),
      service.draw(SUBJECT, 'classique', 'general'),
    ]);
    release();
    await both;

    expect(llm.complete).toHaveBeenCalledTimes(1);
  });

  it('rembourse le crédit quand la génération échoue', async () => {
    emptyPoolThenFilled();
    llm.complete.mockRejectedValue(new Error('gateway down'));

    await expect(service.draw(SUBJECT, 'classique', 'general')).rejects.toThrow(
      'gateway down',
    );
    expect(entitlements.refundCredit).toHaveBeenCalledWith(SUBJECT, 'daily');
  });

  it('ne rembourse rien quand la partie est servie', async () => {
    await service.draw(SUBJECT, 'classique', 'general');

    expect(entitlements.refundCredit).not.toHaveBeenCalled();
  });

  describe('thèmes', () => {
    it('tire dans le pool du thème demandé', async () => {
      await service.draw(SUBJECT, 'classique', 'football');

      expect(prisma.wordPair.count).toHaveBeenCalledWith({
        where: { theme: 'football', spicy: false, id: { notIn: [] } },
      });
    });

    it('injecte la consigne du thème dans le prompt', async () => {
      emptyPoolThenFilled();

      await service.draw(SUBJECT, 'classique', 'football');

      expect(firstPrompt()).toContain('Registre football');
    });
  });

  describe('mode hot', () => {
    it('sépare son pool de celui du même thème en registre normal', async () => {
      await service.draw(SUBJECT, 'hot', 'general');

      expect(prisma.wordPair.count).toHaveBeenCalledWith({
        where: { theme: 'general', spicy: true, id: { notIn: [] } },
      });
    });

    it('demande un registre osé mais borné', async () => {
      emptyPoolThenFilled();

      await service.draw(SUBJECT, 'hot', 'general');

      const prompt = firstPrompt();
      expect(prompt).toContain('osé');
      expect(prompt).toContain('adultes consentants');
      expect(prompt).toContain('rien d’explicite');
    });
  });

  describe('mode défi', () => {
    it('accompagne la partie d’un défi', async () => {
      const result = await service.draw(SUBJECT, 'defi', 'general');

      expect(result.challenge).toBe('Parle à la troisième personne');
      expect(prisma.contentDraw.create).toHaveBeenCalledWith({
        data: { subject: 'device:abc', kind: 'challenge', refId: 'c1' },
      });
    });

    it('ne tire aucun défi dans les autres modes', async () => {
      const result = await service.draw(SUBJECT, 'classique', 'general');

      expect(result.challenge).toBeNull();
      expect(prisma.challenge.count).not.toHaveBeenCalled();
    });

    it('génère des défis quand le stock est vide', async () => {
      prisma.challenge.count.mockResolvedValueOnce(0).mockResolvedValue(1);
      llm.complete.mockResolvedValue(JSON.stringify(['Utilise une couleur']));

      await service.draw(SUBJECT, 'defi', 'general');

      expect(prisma.challenge.createMany).toHaveBeenCalledWith({
        data: [{ text: 'Utilise une couleur' }],
        skipDuplicates: true,
      });
    });
  });
});
