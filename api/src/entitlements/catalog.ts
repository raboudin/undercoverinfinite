/**
 * Catalogue des thèmes et des paliers de difficulté — **source de vérité unique**.
 *
 * Le front ne rejoue aucune de ces règles : il affiche ce que
 * `GET /entitlements` lui renvoie (`themes`, `difficulties`). Dupliquer le
 * barème côté client garantirait qu'il dérive du serveur au premier changement
 * de contenu.
 *
 * Le jeu ne connaît qu'un seul mode (Classique) et est entièrement gratuit —
 * il n'y a donc plus ni packs, ni crédits, ni verrouillage de thème ici.
 */

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
  /**
   * Une phrase pour la vitrine : le front affiche un thème par écran, il lui
   * faut de quoi remplir la fiche. C'est de la copie, pas une règle — d'où sa
   * place ici plutôt que dans le front, qui ne connaît pas la liste des thèmes.
   */
  tagline: string;
  /** Consigne injectée telle quelle dans le prompt LLM. */
  prompt: string;
}

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  general: {
    id: 'general',
    label: 'Tous horizons',
    tagline: 'Tout le terrain, sans spécialité. Le dossier par défaut.',
    prompt:
      'Varie largement les univers : objets du quotidien, lieux, nourriture, métiers, transports, sport, nature.',
  },
  culture: {
    id: 'culture',
    label: 'Culture',
    tagline: 'Livres, musique, scène et traditions. De quoi bluffer poliment.',
    prompt:
      'Registre culture générale : littérature, musique, spectacle, traditions, langue, gastronomie.',
  },
  nature: {
    id: 'nature',
    label: 'Nature',
    tagline: 'Bêtes, plantes et paysages. Deux espèces voisines, un piège.',
    prompt:
      'Registre nature : animaux, plantes, paysages, phénomènes météo, minéraux, milieux marins.',
  },
  technologie: {
    id: 'technologie',
    label: 'Technologie',
    tagline: 'Machines, réseaux et engins. Le jargon ne sauvera personne.',
    prompt:
      'Registre technologie : informatique, réseaux, appareils, ingénierie, transport, espace.',
  },
  personnalites: {
    id: 'personnalites',
    label: 'Personnalités célèbres',
    tagline: 'Des noms connus de tous. Décris sans jamais le prononcer.',
    prompt:
      'Registre personnalités célèbres : des noms propres de personnes connues du grand public francophone (artistes, sportifs, scientifiques, figures politiques). Les deux noms d’une paire doivent appartenir au même domaine.',
  },
  'pop-culture': {
    id: 'pop-culture',
    label: 'Pop culture',
    tagline: 'Films, séries, jeux et héros. Les références volent bas.',
    prompt:
      'Registre pop culture : films, séries, jeux vidéo, mangas, super-héros, musique populaire, personnages de fiction.',
  },
  football: {
    id: 'football',
    label: 'Football',
    tagline:
      'Joueurs, clubs et gestes techniques. Terrain miné entre supporters.',
    prompt:
      'Registre football : joueurs, clubs, compétitions, postes, gestes techniques, stades.',
  },
  'pays-etats': {
    id: 'pays-etats',
    label: 'Pays et États',
    tagline:
      'Frontières et capitales. Deux voisins qu’on confond tout le temps.',
    prompt:
      'Registre géographie politique : pays, États, régions et grandes villes du monde. Les deux éléments d’une paire doivent être facilement confondus (voisins, taille comparable ou réputation proche).',
  },
  'histoire-arts': {
    id: 'histoire-arts',
    label: 'Histoire et arts',
    tagline: 'Époques, monuments et chefs-d’œuvre. Les siècles se ressemblent.',
    prompt:
      'Registre histoire et arts : époques, mouvements artistiques, œuvres majeures, monuments, personnages historiques.',
  },
};

/** Thème servi quand le client n'en demande aucun. */
export const DEFAULT_THEME: ThemeId = 'general';

/* -------------------------------------------------------------------------- */
/* Difficulté                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Éloignement sémantique voulu entre les deux mots d'une paire — de
 * "évident" (le civil et l'undercover décrivent quasiment la même chose) à
 * "farfelu" (le lien ne saute aux yeux qu'après coup). Un entier 1..5 est
 * persisté (`WordPair.difficulty`, `Room.difficulty`) plutôt que l'id texte,
 * pour rester trivialement comparable/ordonnable ; ce module fait la
 * correspondance dans les deux sens.
 */
export const DIFFICULTY_IDS = [
  'evident',
  'facile',
  'normal',
  'difficile',
  'farfelu',
] as const;

export type DifficultyId = (typeof DIFFICULTY_IDS)[number];

export interface DifficultyDefinition {
  id: DifficultyId;
  /** 1 (évident) à 5 (farfelu) — valeur persistée en base. */
  level: number;
  label: string;
  tagline: string;
  /** Consigne d'éloignement injectée dans le prompt LLM. */
  prompt: string;
}

export const DIFFICULTIES: Record<DifficultyId, DifficultyDefinition> = {
  evident: {
    id: 'evident',
    level: 1,
    label: 'Évident',
    tagline: 'Une association immédiate, sans effort.',
    prompt:
      'Les deux mots doivent être presque interchangeables, une association immédiate et sans effort (ex. « Avion » / « Hélicoptère »).',
  },
  facile: {
    id: 'facile',
    level: 2,
    label: 'Facile',
    tagline: 'Le lien saute aux yeux dès la première description.',
    prompt:
      'Les deux mots doivent être clairement apparentés, reconnaissables au premier coup d’œil.',
  },
  normal: {
    id: 'normal',
    level: 3,
    label: 'Normal',
    tagline: 'Assez proches pour bluffer, assez différents pour se faire griller.',
    prompt:
      'Deux termes proches mais bien distincts : assez semblables pour que l’undercover puisse se fondre dans les descriptions, assez différents pour être démasquable.',
  },
  difficile: {
    id: 'difficile',
    level: 4,
    label: 'Difficile',
    tagline: 'Même registre, mais il faut vraiment chercher le lien.',
    prompt:
      'Le lien entre les deux mots doit demander un vrai effort de déduction : même registre, mais nettement éloignés.',
  },
  farfelu: {
    id: 'farfelu',
    level: 5,
    label: 'Farfelu',
    tagline: 'Un lien indirect, qu’on ne voit qu’après coup.',
    prompt:
      'Le lien entre les deux mots doit être indirect, presque abstrait — une association qu’on ne voit qu’après coup.',
  },
};

/** Difficulté servie quand le client n'en demande aucune. */
export const DEFAULT_DIFFICULTY: DifficultyId = 'normal';

/** Convertit un id de difficulté en entier persisté (1..5). */
export function difficultyLevel(id: DifficultyId): number {
  return DIFFICULTIES[id].level;
}

/** Convertit un entier persisté (1..5) en id de difficulté (retombe sur `DEFAULT_DIFFICULTY` hors bornes). */
export function difficultyFromLevel(level: number): DifficultyId {
  const found = DIFFICULTY_IDS.find((id) => DIFFICULTIES[id].level === level);
  return found ?? DEFAULT_DIFFICULTY;
}
