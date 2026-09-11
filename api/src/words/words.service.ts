import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  DIFFICULTIES,
  DIFFICULTY_IDS,
  THEMES,
  THEME_IDS,
  type DifficultyId,
  type ThemeId,
} from '../entitlements/catalog';
import type { Subject } from '../entitlements/subject';
import { PrismaService } from '../prisma/prisma.service';
import { isUniqueViolation } from '../prisma/prisma.errors';
import { LlmClient, parseJsonArray } from './llm.client';

export interface WordPairDto {
  a: string;
  b: string;
}

export interface DrawDto {
  pair: WordPairDto;
}

/**
 * Nombre de paires demandées au LLM en une fois. Les mots ne sont plus produits
 * par un cron quotidien mais quand un tirage n'a plus rien d'inédit à servir ;
 * générer par petits lots plutôt qu'à l'unité amortit l'appel sur plusieurs
 * parties, sans jamais anticiper une demande qui n'existe pas.
 */
const BATCH_SIZE = 8;

/**
 * Profondeur d'historique consultée pour ne pas resservir un contenu.
 * Bornée volontairement : sans plafond, la liste d'exclusion d'un gros joueur
 * finirait par peser plus lourd que le pool lui-même.
 */
const RECENT_DRAWS = 300;

/** Mots réinjectés dans le prompt pour éloigner le lot suivant du précédent. */
const AVOID_SAMPLE = 60;

@Injectable()
export class WordsService {
  private readonly logger = new Logger(WordsService.name);

  /**
   * Générations en cours, une par pool. Deux parties lancées en même temps sur
   * un pool vide ne doivent déclencher qu'un seul appel LLM ; deux pools
   * différents doivent pouvoir se remplir en parallèle.
   */
  private readonly generating = new Map<string, Promise<void>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmClient,
  ) {}

  /** Sert une partie : validation puis tirage, sans notion de droits ni de crédit. */
  async draw(
    subject: Subject,
    theme: ThemeId,
    spicy: boolean,
    difficulty: DifficultyId,
  ): Promise<DrawDto> {
    if (!THEME_IDS.includes(theme)) {
      throw new BadRequestException(`Thème inconnu : ${theme}.`);
    }
    if (!DIFFICULTY_IDS.includes(difficulty)) {
      throw new BadRequestException(`Difficulté inconnue : ${difficulty}.`);
    }

    try {
      const pair = await this.drawPair(subject, theme, spicy, difficulty);
      return { pair };
    } catch (error) {
      throw this.playerFacing(error);
    }
  }

  /**
   * Un échec de génération est une panne de dépendance, pas un bug de l'API :
   * il doit sortir en 503 et non en 500. Sans cette conversion, une
   * `LLM_API_KEY` absente ou un gateway en vrac remonteraient au joueur comme
   * une erreur interne, et le détail technique fuirait dans la réponse.
   */
  private playerFacing(error: unknown): unknown {
    if (error instanceof HttpException) return error;
    this.logger.error('Tirage impossible', error);
    return new ServiceUnavailableException(
      'Le QG n’arrive pas à préparer cette mission. Réessaie dans quelques instants.',
    );
  }

  /* ------------------------------------------------------------------ */
  /* Paires                                                              */
  /* ------------------------------------------------------------------ */

  private async drawPair(
    subject: Subject,
    theme: ThemeId,
    spicy: boolean,
    difficulty: DifficultyId,
  ): Promise<WordPairDto> {
    const level = DIFFICULTIES[difficulty].level;
    const seen = await this.recentlyDrawn(subject);
    const where = { theme, spicy, difficulty: level, id: { notIn: seen } };

    let available = await this.prisma.wordPair.count({ where });
    if (available === 0) {
      await this.fillPool(`pair:${theme}:${spicy}:${level}`, () =>
        this.generatePairs(theme, spicy, difficulty),
      );
      available = await this.prisma.wordPair.count({ where });
    }
    if (available === 0) {
      throw new ServiceUnavailableException(
        'Le QG n’arrive pas à préparer de nouveaux mots. Réessaie dans quelques instants.',
      );
    }

    // `skip` aléatoire faute de `ORDER BY random()` en Prisma : deux tables
    // servies dans la même seconde ne doivent pas recevoir la même paire.
    const [row] = await this.prisma.wordPair.findMany({
      where,
      skip: Math.floor(Math.random() * available),
      take: 1,
    });
    if (!row) {
      throw new ServiceUnavailableException(
        'Le QG n’arrive pas à préparer de nouveaux mots. Réessaie dans quelques instants.',
      );
    }

    await this.markDrawn(subject, row.id);
    return { a: row.wordA, b: row.wordB };
  }

  private async generatePairs(
    theme: ThemeId,
    spicy: boolean,
    difficulty: DifficultyId,
  ): Promise<void> {
    const level = DIFFICULTIES[difficulty].level;
    const recent = await this.prisma.wordPair.findMany({
      where: { theme, spicy, difficulty: level },
      orderBy: { createdAt: 'desc' },
      take: AVOID_SAMPLE,
      select: { wordA: true, wordB: true },
    });
    const avoid = recent.flatMap((row) => [row.wordA, row.wordB]);

    const pairs = this.parsePairs(
      await this.llm.complete(this.pairPrompt(theme, spicy, difficulty, avoid)),
    );

    // `skipDuplicates` : deux instances peuvent générer le même mot au même
    // moment, la contrainte unique fait silencieusement gagner la première.
    await this.prisma.wordPair.createMany({
      data: pairs.map((pair) => ({
        theme,
        spicy,
        difficulty: level,
        wordA: pair.a,
        wordB: pair.b,
      })),
      skipDuplicates: true,
    });
    this.logger.log(
      `${pairs.length} paires générées (thème ${theme}${spicy ? ', hot' : ''}, difficulté ${difficulty})`,
    );
  }

  private pairPrompt(
    theme: ThemeId,
    spicy: boolean,
    difficulty: DifficultyId,
    avoid: string[],
  ): string {
    const registre = spicy
      ? 'Registre volontairement osé, pour une soirée entre adultes consentants : ' +
        'séduction, sorties nocturnes, situations coquines, sous-entendus. ' +
        'Reste suggestif et bon enfant — rien d’explicite, rien d’illégal, ' +
        'aucun contenu impliquant des mineurs ou de la violence. ' +
        `Applique ce registre au cadre suivant. ${THEMES[theme].prompt}`
      : THEMES[theme].prompt;

    const avoidClause =
      avoid.length > 0
        ? `\nMots déjà utilisés, à ne pas reprendre : ${avoid.join(', ')}.`
        : '';

    return (
      `Génère exactement ${BATCH_SIZE} paires de mots français pour le jeu Undercover. ` +
      DIFFICULTIES[difficulty].prompt +
      ' ' +
      registre +
      avoidClause +
      '\nRéponds UNIQUEMENT avec un tableau JSON, sans texte autour, au format : ' +
      '[{"a":"Mot1","b":"Mot2"}, …]'
    );
  }

  private parsePairs(content: string): WordPairDto[] {
    const pairs: WordPairDto[] = [];
    const seen = new Set<string>();

    for (const item of parseJsonArray(content)) {
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

    if (pairs.length === 0) {
      throw new Error('Réponse LLM : aucune paire exploitable');
    }
    return pairs;
  }

  /* ------------------------------------------------------------------ */
  /* Pool                                                                */
  /* ------------------------------------------------------------------ */

  /**
   * Remplit un pool en dédupliquant les appels concurrents : dix parties
   * lancées ensemble sur un thème vide ne doivent produire qu'un seul appel
   * LLM, pas dix.
   */
  private fillPool(key: string, generate: () => Promise<void>): Promise<void> {
    const inFlight = this.generating.get(key);
    if (inFlight) return inFlight;

    const started = generate().finally(() => this.generating.delete(key));
    this.generating.set(key, started);
    return started;
  }

  /** Identifiants récemment servis à ce sujet, pour ne pas les resservir. */
  private async recentlyDrawn(subject: Subject): Promise<string[]> {
    const rows = await this.prisma.contentDraw.findMany({
      where: { subject: subject.key, kind: 'pair' },
      orderBy: { drawnAt: 'desc' },
      take: RECENT_DRAWS,
      select: { refId: true },
    });
    return rows.map((row) => row.refId);
  }

  private async markDrawn(subject: Subject, refId: string): Promise<void> {
    try {
      await this.prisma.contentDraw.create({
        data: { subject: subject.key, kind: 'pair', refId },
      });
    } catch (error) {
      // Déjà noté (le contenu était sorti de la fenêtre récente) : sans
      // importance, l'objectif est seulement d'espacer les redites.
      if (!isUniqueViolation(error)) throw error;
    }
  }
}
