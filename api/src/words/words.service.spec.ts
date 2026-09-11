import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import type { Subject } from '../entitlements/subject';
import type { PrismaService } from '../prisma/prisma.service';
import type { LlmClient } from './llm.client';
import { WordsService } from './words.service';

const SUBJECT: Subject = { key: 'device:abc', userId: null };

const GENERATED = [
  { a: 'Café', b: 'Thé' },
  { a: 'Avion', b: 'Hélicoptère' },
];

function pairRow(id: string, a: string, b: string) {
  return {
    id,
    theme: 'general',
    spicy: false,
    difficulty: 3,
    wordA: a,
    wordB: b,
    createdAt: new Date(),
  };
}

describe('WordsService', () => {
  let prisma: {
    wordPair: { count: jest.Mock; findMany: jest.Mock; createMany: jest.Mock };
    contentDraw: { findMany: jest.Mock; create: jest.Mock };
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
      contentDraw: {
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockResolvedValue({}),
      },
    };
    llm = { complete: jest.fn().mockResolvedValue(JSON.stringify(GENERATED)) };

    service = new WordsService(
      prisma as unknown as PrismaService,
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
    const result = await service.draw(SUBJECT, 'general', false, 'normal');

    expect(result.pair).toEqual({ a: 'Café', b: 'Thé' });
    expect(llm.complete).not.toHaveBeenCalled();
  });

  it('refuse un thème inconnu', async () => {
    await expect(
      service.draw(SUBJECT, 'inexistant' as never, false, 'normal'),
    ).rejects.toThrow(BadRequestException);
  });

  it('refuse une difficulté inconnue', async () => {
    await expect(
      service.draw(SUBJECT, 'general', false, 'extreme' as never),
    ).rejects.toThrow(BadRequestException);
  });

  it('note le tirage pour ne pas resservir la même paire', async () => {
    await service.draw(SUBJECT, 'general', false, 'normal');

    expect(prisma.contentDraw.create).toHaveBeenCalledWith({
      data: { subject: 'device:abc', kind: 'pair', refId: 'p1' },
    });
  });

  it('exclut du tirage ce que le sujet a déjà vu', async () => {
    prisma.contentDraw.findMany.mockResolvedValue([{ refId: 'p0' }]);

    await service.draw(SUBJECT, 'general', false, 'normal');

    expect(prisma.wordPair.count).toHaveBeenCalledWith({
      where: { theme: 'general', spicy: false, difficulty: 3, id: { notIn: ['p0'] } },
    });
  });

  it('génère un lot quand le pool n’a plus rien d’inédit', async () => {
    emptyPoolThenFilled();

    await service.draw(SUBJECT, 'general', false, 'normal');

    expect(llm.complete).toHaveBeenCalledTimes(1);
    expect(prisma.wordPair.createMany).toHaveBeenCalledWith({
      data: [
        { theme: 'general', spicy: false, difficulty: 3, wordA: 'Café', wordB: 'Thé' },
        {
          theme: 'general',
          spicy: false,
          difficulty: 3,
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
      service.draw(SUBJECT, 'general', false, 'normal'),
      service.draw(SUBJECT, 'general', false, 'normal'),
    ]);
    release();
    await both;

    expect(llm.complete).toHaveBeenCalledTimes(1);
  });

  it('sort une panne de LLM en 503, sans exposer le détail technique', async () => {
    emptyPoolThenFilled();
    llm.complete.mockRejectedValue(new Error('LLM_API_KEY manquante'));

    // Un 500 dirait « bug de l'API » là où la dépendance seule est en cause.
    await expect(
      service.draw(SUBJECT, 'general', false, 'normal'),
    ).rejects.toThrow(/Le QG n’arrive pas à préparer cette mission/);
  });

  describe('thèmes', () => {
    it('tire dans le pool du thème demandé', async () => {
      await service.draw(SUBJECT, 'football', false, 'normal');

      expect(prisma.wordPair.count).toHaveBeenCalledWith({
        where: { theme: 'football', spicy: false, difficulty: 3, id: { notIn: [] } },
      });
    });

    it('injecte la consigne du thème dans le prompt', async () => {
      emptyPoolThenFilled();

      await service.draw(SUBJECT, 'football', false, 'normal');

      expect(firstPrompt()).toContain('Registre football');
    });
  });

  describe('contenu hot', () => {
    it('sépare son pool de celui du même thème en registre normal', async () => {
      await service.draw(SUBJECT, 'general', true, 'normal');

      expect(prisma.wordPair.count).toHaveBeenCalledWith({
        where: { theme: 'general', spicy: true, difficulty: 3, id: { notIn: [] } },
      });
    });

    it('demande un registre osé mais borné', async () => {
      emptyPoolThenFilled();

      await service.draw(SUBJECT, 'general', true, 'normal');

      const prompt = firstPrompt();
      expect(prompt).toContain('osé');
      expect(prompt).toContain('adultes consentants');
      expect(prompt).toContain('rien d’explicite');
    });

    it('se combine avec n’importe quel thème, indépendamment de celui-ci', async () => {
      await service.draw(SUBJECT, 'football', true, 'normal');

      expect(prisma.wordPair.count).toHaveBeenCalledWith({
        where: { theme: 'football', spicy: true, difficulty: 3, id: { notIn: [] } },
      });
    });
  });

  describe('difficulté', () => {
    it('sépare son pool de celui d’une autre difficulté', async () => {
      await service.draw(SUBJECT, 'general', false, 'farfelu');

      expect(prisma.wordPair.count).toHaveBeenCalledWith({
        where: { theme: 'general', spicy: false, difficulty: 5, id: { notIn: [] } },
      });
    });

    it('injecte la consigne d’éloignement du palier dans le prompt', async () => {
      emptyPoolThenFilled();

      await service.draw(SUBJECT, 'general', false, 'evident');

      expect(firstPrompt()).toContain('presque interchangeables');
    });
  });
});
