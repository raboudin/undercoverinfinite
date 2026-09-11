import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import {
  DIFFICULTY_IDS,
  THEME_IDS,
  type DifficultyId,
  type ThemeId,
} from '../../entitlements/catalog';

/**
 * Corps de `POST /words/draw`. Le `ValidationPipe` global est en
 * `forbidNonWhitelisted` : tout champ non déclaré ici fait échouer la requête,
 * ce qui interdit de glisser un thème par un chemin détourné.
 */
export class DrawWordsDto {
  /** Facultatif : sans thème, la partie se joue en « Tous horizons ». */
  @IsOptional()
  @IsIn([...THEME_IDS], { message: 'Thème inconnu.' })
  theme?: ThemeId;

  /** Contenu hot, indépendant du thème. Absent = registre normal. */
  @IsOptional()
  @IsBoolean()
  spicy?: boolean;

  /** Facultatif : sans difficulté, la partie se joue en « Normal ». */
  @IsOptional()
  @IsIn([...DIFFICULTY_IDS], { message: 'Difficulté inconnue.' })
  difficulty?: DifficultyId;
}
