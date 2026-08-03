/**
 * Catalogue des modes, thèmes et packs — **source de vérité unique**.
 *
 * Le front ne rejoue aucune de ces règles : il affiche ce que
 * `GET /entitlements` lui renvoie (`modes`, `themes`, `credits`). Dupliquer le
 * barème côté client garantirait qu'il dérive du serveur au premier changement
 * de prix ou de contenu de pack.
 */

/* -------------------------------------------------------------------------- */
/* Modes                                                                       */
/* -------------------------------------------------------------------------- */

export const MODE_IDS = [
  'classique',
  'chrono',
  'hot',
  'defi',
  'teams',
  'pari',
  'diy',
] as const;

export type ModeId = (typeof MODE_IDS)[number];

export interface ModeDefinition {
  id: ModeId;
  label: string;
  tagline: string;
  /**
   * `false` = le pack donne bien le droit d'y jouer, mais les règles ne sont
   * pas encore implémentées. Le front l'affiche « bientôt » plutôt que de le
   * cacher : l'acheteur doit voir ce qu'il aura.
   */
  available: boolean;
  /** Le mode force des mots d'un registre osé (voir `spicy` côté pool). */
  spicy?: boolean;
}

export const MODES: Record<ModeId, ModeDefinition> = {
  classique: {
    id: 'classique',
    label: 'Classique',
    tagline: 'La mission d’origine : décrire, douter, éliminer.',
    available: true,
  },
  chrono: {
    id: 'chrono',
    label: 'Chrono',
    tagline: 'Chaque prise de parole est minutée. Hésiter, c’est se griller.',
    available: true,
  },
  hot: {
    id: 'hot',
    label: 'Hot',
    tagline: 'Mêmes règles, mots nettement plus osés. Réservé aux adultes.',
    available: true,
    spicy: true,
  },
  defi: {
    id: 'defi',
    label: 'Défi',
    tagline: 'Un défi commun accompagne la partie, du début à la fin.',
    available: true,
  },
  teams: {
    id: 'teams',
    label: 'Teams',
    tagline: 'Deux équipes, trois mots, un score qui court sur la soirée.',
    // Règles non écrites : le pack infinite l'inclut, le jeu ne le sert pas encore.
    available: false,
  },
  pari: {
    id: 'pari',
    label: 'Pari risqué',
    tagline:
      'Chacun mise sur un suspect. L’app tient les comptes, rien de plus.',
    available: true,
  },
  diy: {
    id: 'diy',
    label: 'DIY',
    tagline: 'Tu choisis le mode et tu écris toi-même les deux mots.',
    available: true,
  },
};

/** Modes ouverts sans aucun compte. */
export const ANONYMOUS_MODES: ModeId[] = ['classique'];

/**
 * Modes ouverts dès qu'un compte existe. Le chrono est le cadeau de bienvenue :
 * il ne coûte rien en génération de mots, il n'a donc pas à être payant.
 */
export const ACCOUNT_MODES: ModeId[] = ['classique', 'chrono'];

/* -------------------------------------------------------------------------- */
/* Thèmes                                                                      */
/* -------------------------------------------------------------------------- */

export const THEME_IDS = [
  'general',
  'culture',
  'nature',
  'technologie',
  'personnalites',
  'pop-culture',
  'football',
  'pays-etats',
  'histoire-arts',
] as const;

export type ThemeId = (typeof THEME_IDS)[number];

export interface ThemeDefinition {
  id: ThemeId;
  label: string;
  /** Généraliste = accessible à tous, compte ou non, pack ou non. */
  generalist: boolean;
  /** Consigne injectée telle quelle dans le prompt LLM. */
  prompt: string;
}

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  general: {
    id: 'general',
    label: 'Tous horizons',
    generalist: true,
    prompt:
      'Varie largement les univers : objets du quotidien, lieux, nourriture, métiers, transports, sport, nature.',
  },
  culture: {
    id: 'culture',
    label: 'Culture',
    generalist: true,
    prompt:
      'Registre culture générale : littérature, musique, spectacle, traditions, langue, gastronomie.',
  },
  nature: {
    id: 'nature',
    label: 'Nature',
    generalist: true,
    prompt:
      'Registre nature : animaux, plantes, paysages, phénomènes météo, minéraux, milieux marins.',
  },
  technologie: {
    id: 'technologie',
    label: 'Technologie',
    generalist: true,
    prompt:
      'Registre technologie : informatique, réseaux, appareils, ingénierie, transport, espace.',
  },
  personnalites: {
    id: 'personnalites',
    label: 'Personnalités célèbres',
    generalist: false,
    prompt:
      'Registre personnalités célèbres : des noms propres de personnes connues du grand public francophone (artistes, sportifs, scientifiques, figures politiques). Les deux noms d’une paire doivent appartenir au même domaine.',
  },
  'pop-culture': {
    id: 'pop-culture',
    label: 'Pop culture',
    generalist: false,
    prompt:
      'Registre pop culture : films, séries, jeux vidéo, mangas, super-héros, musique populaire, personnages de fiction.',
  },
  football: {
    id: 'football',
    label: 'Football',
    generalist: false,
    prompt:
      'Registre football : joueurs, clubs, compétitions, postes, gestes techniques, stades.',
  },
  'pays-etats': {
    id: 'pays-etats',
    label: 'Pays et États',
    generalist: false,
    prompt:
      'Registre géographie politique : pays, États, régions et grandes villes du monde. Les deux éléments d’une paire doivent être facilement confondus (voisins, taille comparable ou réputation proche).',
  },
  'histoire-arts': {
    id: 'histoire-arts',
    label: 'Histoire et arts',
    generalist: false,
    prompt:
      'Registre histoire et arts : époques, mouvements artistiques, œuvres majeures, monuments, personnages historiques.',
  },
};

export const GENERALIST_THEMES: ThemeId[] = THEME_IDS.filter(
  (id) => THEMES[id].generalist,
);

/** Thème servi quand le client n'en demande aucun. */
export const DEFAULT_THEME: ThemeId = 'general';

/* -------------------------------------------------------------------------- */
/* Crédits                                                                     */
/* -------------------------------------------------------------------------- */

/** Un crédit = une partie, quel que soit le nombre de mots qu'elle demande. */
export const FREE_DAILY_CREDITS = 5;

/**
 * Les packs dits « illimités » restent plafonnés : sans cette borne, un seul
 * compte pourrait déclencher un nombre non borné d'appels LLM.
 */
export const UNLIMITED_DAILY_CREDITS = 50;

/* -------------------------------------------------------------------------- */
/* Packs                                                                       */
/* -------------------------------------------------------------------------- */

export const PACK_IDS = [
  'credits20',
  'unlimited',
  'discover',
  'diamond',
  'infinite',
] as const;

export type PackId = (typeof PACK_IDS)[number];

export interface PackDefinition {
  id: PackId;
  label: string;
  tagline: string;
  priceEur: number;
  /** Modes ajoutés au socle du compte. */
  modes: ModeId[];
  /** `true` = tous les thèmes ; `false` = seulement les généralistes. */
  allThemes: boolean;
  /** Relève le quota quotidien à `UNLIMITED_DAILY_CREDITS`. */
  unlimited: boolean;
  /** Crédits versés au portefeuille au déblocage (pack de recharge). */
  credits: number;
}

export const PACKS: Record<PackId, PackDefinition> = {
  credits20: {
    id: 'credits20',
    label: '20 crédits',
    tagline: 'Une recharge de 20 parties, sans date de péremption.',
    priceEur: 1.99,
    modes: [],
    allThemes: false,
    unlimited: false,
    credits: 20,
  },
  unlimited: {
    id: 'unlimited',
    label: 'Illimité',
    tagline: 'Parties illimitées sur les thèmes généralistes.',
    priceEur: 2.99,
    modes: [],
    allThemes: false,
    unlimited: true,
    credits: 0,
  },
  discover: {
    id: 'discover',
    label: 'Discover',
    tagline: 'Illimité généraliste, plus les modes chrono et hot.',
    priceEur: 3.59,
    modes: ['chrono', 'hot'],
    allThemes: false,
    unlimited: true,
    credits: 0,
  },
  diamond: {
    id: 'diamond',
    label: 'Diamond',
    tagline: 'Chrono, hot et défi, et tous les thèmes ouverts.',
    priceEur: 4.59,
    modes: ['chrono', 'hot', 'defi'],
    allThemes: true,
    unlimited: true,
    credits: 0,
  },
  infinite: {
    id: 'infinite',
    label: 'Infinite',
    tagline: 'Tous les modes, tous les thèmes, sans rien à rouvrir.',
    priceEur: 6.99,
    modes: ['chrono', 'hot', 'defi', 'teams', 'pari', 'diy'],
    allThemes: true,
    unlimited: true,
    credits: 0,
  },
};

/* -------------------------------------------------------------------------- */
/* Résolution                                                                  */
/* -------------------------------------------------------------------------- */

export interface ResolvedAccess {
  modes: ModeId[];
  themes: ThemeId[];
  /** Quota quotidien, relevé si un pack illimité est détenu. */
  dailyLimit: number;
  unlimited: boolean;
}

function isPackId(value: string): value is PackId {
  return (PACK_IDS as readonly string[]).includes(value);
}

/** Ne garde que les identifiants de pack connus (une ligne en base peut être obsolète). */
export function knownPacks(packs: string[]): PackId[] {
  return packs.filter(isPackId);
}

/**
 * Ce à quoi un joueur a droit : le socle (anonyme ou compte) plus l'union de
 * ses packs. Un pack n'enlève jamais rien, il ne fait qu'ajouter — ce qui rend
 * l'ordre de déblocage sans importance.
 */
export function resolveAccess(options: {
  hasAccount: boolean;
  packs: PackId[];
}): ResolvedAccess {
  const definitions = options.packs.map((pack) => PACKS[pack]);

  const modes = new Set<ModeId>(
    options.hasAccount ? ACCOUNT_MODES : ANONYMOUS_MODES,
  );
  // Un pack n'a de valeur qu'avec un compte : c'est lui qui le porte. Sans
  // compte il n'y a de toute façon aucune ligne `entitlements` à lire.
  if (options.hasAccount) {
    for (const pack of definitions) {
      for (const mode of pack.modes) modes.add(mode);
    }
  }

  const allThemes =
    options.hasAccount && definitions.some((pack) => pack.allThemes);
  const unlimited =
    options.hasAccount && definitions.some((pack) => pack.unlimited);

  return {
    modes: MODE_IDS.filter((id) => modes.has(id)),
    themes: allThemes ? [...THEME_IDS] : [...GENERALIST_THEMES],
    dailyLimit: unlimited ? UNLIMITED_DAILY_CREDITS : FREE_DAILY_CREDITS,
    unlimited,
  };
}
