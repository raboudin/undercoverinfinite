import { Injectable } from '@nestjs/common';
import {
  DIFFICULTIES,
  DIFFICULTY_IDS,
  THEMES,
  THEME_IDS,
  type DifficultyId,
  type ThemeId,
} from './catalog';

/** Thème exposé au client — sans le prompt, qui reste un détail serveur. */
export interface PublicThemeDto {
  id: ThemeId;
  label: string;
  tagline: string;
}

/** Difficulté exposée au client — sans le prompt, qui reste un détail serveur. */
export interface PublicDifficultyDto {
  id: DifficultyId;
  level: number;
  label: string;
  tagline: string;
}

export interface EntitlementsDto {
  themes: PublicThemeDto[];
  difficulties: PublicDifficultyDto[];
}

export interface CatalogDto {
  themes: PublicThemeDto[];
  difficulties: PublicDifficultyDto[];
}

/**
 * Thèmes et paliers de difficulté disponibles — le jeu est entièrement
 * gratuit et ne connaît qu'un seul mode (Classique), il n'y a donc plus de
 * notion de droits par sujet : cette réponse est la même pour tout le monde.
 */
@Injectable()
export class EntitlementsService {
  /** Catalogue public, identique pour tout le monde. */
  catalog(): CatalogDto {
    return {
      themes: THEME_IDS.map((id) => ({
        id,
        label: THEMES[id].label,
        tagline: THEMES[id].tagline,
      })),
      difficulties: DIFFICULTY_IDS.map((id) => ({
        id,
        level: DIFFICULTIES[id].level,
        label: DIFFICULTIES[id].label,
        tagline: DIFFICULTIES[id].tagline,
      })),
    };
  }

  /** Réponse de `GET /entitlements` — alias du catalogue, sans notion de sujet. */
  resolve(): EntitlementsDto {
    return this.catalog();
  }
}
