import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

export interface WordPairDto {
  a: string;
  b: string;
}

export interface DailyWordsDto {
  day: string;
  pairs: WordPairDto[];
}

/** Nombre de paires générées chaque jour — le quota gratuit quotidien. */
export const PAIRS_PER_DAY = 5;

/** Le « jour » du jeu suit ce fuseau, côté cron comme côté clé de lot. */
export const WORDS_TIMEZONE = 'Europe/Paris';

const GATEWAY_URL = 'https://ai-gateway.vercel.sh/v1/chat/completions';
const DEFAULT_MODEL = 'google/gemini-3.5-flash-lite';

/** Fenêtre passée réinjectée dans le prompt pour éviter les redites. */
const AVOID_REPEATS_DAYS = 14;

@Injectable()
export class WordsService {
  private readonly logger = new Logger(WordsService.name);

  /**
   * Génération en cours, partagée : deux requêtes simultanées sur un lot
   * manquant ne doivent déclencher qu'un seul appel LLM.
   */
  private generating: Promise<void> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  /** Date du jour au format YYYY-MM-DD dans le fuseau du jeu. */
  todayKey(now: Date = new Date()): string {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: WORDS_TIMEZONE,
    }).format(now);
  }

  /**
   * Le lot du jour est normalement produit ici, à heure fixe. `getToday`
   * sait aussi le générer à la demande si le serveur était éteint à ce
   * moment-là — le cron n'est donc pas un point de défaillance unique.
   */
  @Cron('5 0 * * *', { timeZone: WORDS_TIMEZONE })
  async generateDailyBatch(): Promise<void> {
    try {
      await this.ensureBatch(this.todayKey());
    } catch (error) {
      this.logger.error('Génération du lot quotidien échouée', error);
    }
  }

  async getToday(): Promise<DailyWordsDto> {
    const day = this.todayKey();
    let pairs = await this.findPairs(day);
    if (pairs.length === 0) {
      try {
        await this.ensureBatch(day);
      } catch (error) {
        this.logger.error(`Génération à la demande échouée pour ${day}`, error);
      }
      pairs = await this.findPairs(day);
    }
    if (pairs.length === 0) {
      throw new ServiceUnavailableException(
        'Les mots du jour ne sont pas disponibles pour le moment. Réessaie dans quelques instants.',
      );
    }
    return { day, pairs };
  }

  private async findPairs(day: string): Promise<WordPairDto[]> {
    const rows = await this.prisma.dailyWordPair.findMany({
      where: { day: new Date(day) },
      orderBy: { position: 'asc' },
    });
    return rows.map((row) => ({ a: row.wordA, b: row.wordB }));
  }

  private ensureBatch(day: string): Promise<void> {
    this.generating ??= this.generateAndStore(day).finally(() => {
      this.generating = null;
    });
    return this.generating;
  }

  private async generateAndStore(day: string): Promise<void> {
    // Revérifié sous le verrou : le lot a pu être créé entre-temps.
    const existing = await this.prisma.dailyWordPair.count({
      where: { day: new Date(day) },
    });
    if (existing > 0) return;

    const since = new Date(day);
    since.setUTCDate(since.getUTCDate() - AVOID_REPEATS_DAYS);
    const recent = await this.prisma.dailyWordPair.findMany({
      where: { day: { gte: since } },
    });
    const avoid = recent.flatMap((row) => [row.wordA, row.wordB]);

    const pairs = await this.callLlm(avoid);

    // skipDuplicates : si deux instances génèrent en parallèle, la contrainte
    // unique (day, position) fait silencieusement gagner la première.
    await this.prisma.dailyWordPair.createMany({
      data: pairs.map((pair, position) => ({
        day: new Date(day),
        position,
        wordA: pair.a,
        wordB: pair.b,
      })),
      skipDuplicates: true,
    });
    this.logger.log(`Lot de ${pairs.length} paires généré pour ${day}`);
  }

  private async callLlm(avoid: string[]): Promise<WordPairDto[]> {
    const apiKey = process.env.LLM_API_KEY;
    if (!apiKey) {
      throw new Error('LLM_API_KEY manquante : impossible de générer les mots');
    }
    const model = process.env.LLM_MODEL ?? DEFAULT_MODEL;

    const avoidClause =
      avoid.length > 0
        ? `\nMots déjà utilisés récemment, à ne pas reprendre : ${avoid.join(', ')}.`
        : '';
    const prompt =
      `Génère exactement ${PAIRS_PER_DAY} paires de mots français pour le jeu Undercover. ` +
      'Chaque paire contient deux noms communs proches mais bien distincts ' +
      '(ex. « Café » / « Thé », « Passeport » / « Visa ») : assez semblables pour que ' +
      "l'undercover puisse se fondre dans les descriptions, assez différents pour être démasquable. " +
      'Varie les univers (objets, lieux, nourriture, métiers, nature…).' +
      avoidClause +
      '\nRéponds UNIQUEMENT avec un tableau JSON, sans texte autour, au format : ' +
      '[{"a":"Mot1","b":"Mot2"}, …]';

    const response = await fetch(GATEWAY_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 1,
      }),
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(
        `Le gateway LLM a répondu ${response.status} : ${detail.slice(0, 500)}`,
      );
    }
    const payload: unknown = await response.json();
    return this.parsePairs(this.extractContent(payload));
  }

  /** Extrait `choices[0].message.content` d'une réponse OpenAI-compatible. */
  private extractContent(payload: unknown): string {
    if (typeof payload === 'object' && payload !== null) {
      const choices = (payload as Record<string, unknown>).choices;
      if (Array.isArray(choices) && choices.length > 0) {
        const first: unknown = choices[0];
        if (typeof first === 'object' && first !== null) {
          const message = (first as Record<string, unknown>).message;
          if (typeof message === 'object' && message !== null) {
            const content = (message as Record<string, unknown>).content;
            if (typeof content === 'string') return content;
          }
        }
      }
    }
    throw new Error('Réponse LLM sans contenu exploitable');
  }

  private parsePairs(content: string): WordPairDto[] {
    // Les modèles emballent parfois le JSON dans des fences markdown.
    const stripped = content
      .trim()
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/, '');
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripped);
    } catch {
      throw new Error(`Réponse LLM illisible : ${content.slice(0, 200)}`);
    }
    if (!Array.isArray(parsed)) {
      throw new Error('Réponse LLM : un tableau JSON était attendu');
    }

    const pairs: WordPairDto[] = [];
    const seen = new Set<string>();
    for (const item of parsed) {
      if (typeof item !== 'object' || item === null) continue;
      const { a, b } = item as Record<string, unknown>;
      if (typeof a !== 'string' || typeof b !== 'string') continue;
      const wordA = a.trim();
      const wordB = b.trim();
      if (!wordA || !wordB) continue;
      if (wordA.toLocaleLowerCase() === wordB.toLocaleLowerCase()) continue;
      const key = [wordA, wordB]
        .map((word) => word.toLocaleLowerCase())
        .sort()
        .join('|');
      if (seen.has(key)) continue;
      seen.add(key);
      pairs.push({ a: wordA, b: wordB });
    }

    if (pairs.length < PAIRS_PER_DAY) {
      throw new Error(
        `Réponse LLM : ${pairs.length} paires valides sur ${PAIRS_PER_DAY} attendues`,
      );
    }
    return pairs.slice(0, PAIRS_PER_DAY);
  }
}
