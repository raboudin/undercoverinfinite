import { ServiceUnavailableException } from '@nestjs/common';
import {
  WordsService,
  PAIRS_PER_DAY,
  DEFAULT_MODEL,
  DEFAULT_GATEWAY_URL,
} from './words.service';
import type { PrismaService } from '../prisma/prisma.service';

const FIVE_PAIRS = [
  { a: 'Café', b: 'Thé' },
  { a: 'Avion', b: 'Hélicoptère' },
  { a: 'Chien', b: 'Loup' },
  { a: 'Passeport', b: 'Visa' },
  { a: 'Valise', b: 'Sac à dos' },
];

/** Réponse OpenAI-compatible telle que la renvoie le Vercel AI Gateway. */
function gatewayResponse(content: string) {
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        choices: [{ message: { content } }],
      }) as Promise<unknown>,
  } as Response;
}

function rowsFor(pairs: { a: string; b: string }[]) {
  return pairs.map((pair, position) => ({
    id: `id-${position}`,
    day: new Date('2026-08-02'),
    position,
    wordA: pair.a,
    wordB: pair.b,
    createdAt: new Date(),
  }));
}

describe('WordsService', () => {
  let prisma: {
    dailyWordPair: {
      findMany: jest.Mock;
      count: jest.Mock;
      createMany: jest.Mock;
    };
  };
  let service: WordsService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    prisma = {
      dailyWordPair: {
        findMany: jest.fn(),
        count: jest.fn(),
        createMany: jest.fn().mockResolvedValue({ count: PAIRS_PER_DAY }),
      },
    };
    service = new WordsService(prisma as unknown as PrismaService);
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    process.env.LLM_API_KEY = 'test-key';
  });

  afterEach(() => {
    delete process.env.LLM_API_KEY;
    delete process.env.LLM_MODEL;
    delete process.env.LLM_GATEWAY_URL;
  });

  /** Amène les mocks dans l'état « lot manquant, génération nécessaire ». */
  function primeGeneration() {
    prisma.dailyWordPair.findMany
      .mockResolvedValueOnce([]) // lot du jour : absent
      .mockResolvedValueOnce([]) // historique récent pour le prompt
      .mockResolvedValueOnce(rowsFor(FIVE_PAIRS)); // relecture après insertion
    prisma.dailyWordPair.count.mockResolvedValue(0);
    fetchMock.mockResolvedValue(gatewayResponse(JSON.stringify(FIVE_PAIRS)));
  }

  describe('config LLM par environnement', () => {
    it('honore LLM_MODEL et LLM_GATEWAY_URL', async () => {
      process.env.LLM_MODEL = 'openai/gpt-5-mini';
      process.env.LLM_GATEWAY_URL = 'https://autre-gateway.test/v1/chat';
      primeGeneration();

      await service.getToday();

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://autre-gateway.test/v1/chat');
      expect(JSON.parse(init.body as string)).toMatchObject({
        model: 'openai/gpt-5-mini',
      });
    });

    it('retombe sur les défauts quand les variables sont vides', async () => {
      process.env.LLM_MODEL = '   ';
      process.env.LLM_GATEWAY_URL = '';
      primeGeneration();

      await service.getToday();

      const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(DEFAULT_GATEWAY_URL);
      expect(JSON.parse(init.body as string)).toMatchObject({
        model: DEFAULT_MODEL,
      });
    });
  });

  describe('todayKey', () => {
    it('rend la date du fuseau Europe/Paris, pas UTC', () => {
      // 23h30 UTC le 1er août = 01h30 le 2 août à Paris (été, UTC+2).
      expect(service.todayKey(new Date('2026-08-01T23:30:00Z'))).toBe(
        '2026-08-02',
      );
      expect(service.todayKey(new Date('2026-08-01T12:00:00Z'))).toBe(
        '2026-08-01',
      );
    });
  });

  describe('getToday', () => {
    it('sert le lot existant sans appeler le LLM', async () => {
      prisma.dailyWordPair.findMany.mockResolvedValue(rowsFor(FIVE_PAIRS));

      const result = await service.getToday();

      expect(result.pairs).toEqual(FIVE_PAIRS);
      expect(result.day).toBe(service.todayKey());
      expect(fetchMock).not.toHaveBeenCalled();
      expect(prisma.dailyWordPair.createMany).not.toHaveBeenCalled();
    });

    it('génère et stocke le lot quand il manque', async () => {
      prisma.dailyWordPair.findMany
        .mockResolvedValueOnce([]) // lot du jour : absent
        .mockResolvedValueOnce([]) // historique récent pour le prompt
        .mockResolvedValueOnce(rowsFor(FIVE_PAIRS)); // relecture après insertion
      prisma.dailyWordPair.count.mockResolvedValue(0);
      fetchMock.mockResolvedValue(gatewayResponse(JSON.stringify(FIVE_PAIRS)));

      const result = await service.getToday();

      expect(result.pairs).toEqual(FIVE_PAIRS);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(prisma.dailyWordPair.createMany).toHaveBeenCalledWith({
        data: FIVE_PAIRS.map((pair, position) => ({
          day: new Date(service.todayKey()),
          position,
          wordA: pair.a,
          wordB: pair.b,
        })),
        skipDuplicates: true,
      });
    });

    it('accepte un JSON emballé dans des fences markdown', async () => {
      prisma.dailyWordPair.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce(rowsFor(FIVE_PAIRS));
      prisma.dailyWordPair.count.mockResolvedValue(0);
      fetchMock.mockResolvedValue(
        gatewayResponse('```json\n' + JSON.stringify(FIVE_PAIRS) + '\n```'),
      );

      const result = await service.getToday();
      expect(result.pairs).toEqual(FIVE_PAIRS);
    });

    it('écarte les paires invalides et refuse un lot incomplet', async () => {
      prisma.dailyWordPair.findMany.mockResolvedValue([]);
      prisma.dailyWordPair.count.mockResolvedValue(0);
      const broken = [
        { a: 'Café', b: 'Café' }, // identiques
        { a: 'Thé', b: '' }, // mot vide
        { a: 'Chien', b: 'Loup' },
        { a: 'Loup', b: 'Chien' }, // doublon inversé
        { a: 'Avion', b: 'Hélicoptère' },
      ];
      fetchMock.mockResolvedValue(gatewayResponse(JSON.stringify(broken)));

      await expect(service.getToday()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(prisma.dailyWordPair.createMany).not.toHaveBeenCalled();
    });

    it('répond 503 quand le gateway est en erreur', async () => {
      prisma.dailyWordPair.findMany.mockResolvedValue([]);
      prisma.dailyWordPair.count.mockResolvedValue(0);
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('boom'),
      });

      await expect(service.getToday()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('répond 503 sans LLM_API_KEY plutôt que de planter', async () => {
      delete process.env.LLM_API_KEY;
      prisma.dailyWordPair.findMany.mockResolvedValue([]);
      prisma.dailyWordPair.count.mockResolvedValue(0);

      await expect(service.getToday()).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('ne lance qu’une génération pour des requêtes simultanées', async () => {
      prisma.dailyWordPair.findMany.mockImplementation(
        (args: { orderBy?: unknown }) =>
          // Les lectures du lot (triées par position) restent vides pendant la
          // génération ; l'historique du prompt aussi.
          Promise.resolve(
            args.orderBy &&
              prisma.dailyWordPair.createMany.mock.calls.length > 0
              ? rowsFor(FIVE_PAIRS)
              : [],
          ),
      );
      prisma.dailyWordPair.count.mockResolvedValue(0);
      fetchMock.mockResolvedValue(gatewayResponse(JSON.stringify(FIVE_PAIRS)));

      const [first, second] = await Promise.all([
        service.getToday(),
        service.getToday(),
      ]);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(first.pairs).toEqual(FIVE_PAIRS);
      expect(second.pairs).toEqual(FIVE_PAIRS);
    });
  });

  describe('generateDailyBatch (cron)', () => {
    it('ne crée rien si le lot du jour existe déjà', async () => {
      prisma.dailyWordPair.count.mockResolvedValue(PAIRS_PER_DAY);

      await service.generateDailyBatch();

      expect(fetchMock).not.toHaveBeenCalled();
      expect(prisma.dailyWordPair.createMany).not.toHaveBeenCalled();
    });

    it('avale les erreurs LLM au lieu de faire tomber le cron', async () => {
      prisma.dailyWordPair.count.mockResolvedValue(0);
      prisma.dailyWordPair.findMany.mockResolvedValue([]);
      fetchMock.mockRejectedValue(new Error('réseau HS'));

      await expect(service.generateDailyBatch()).resolves.toBeUndefined();
    });
  });
});
