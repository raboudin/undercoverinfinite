import { IsIn, IsOptional } from 'class-validator';
import {
  MODE_IDS,
  THEME_IDS,
  type ModeId,
  type ThemeId,
} from '../../entitlements/catalog';

/**
 * Corps de `POST /words/draw`. Le `ValidationPipe` global est en
 * `forbidNonWhitelisted` : tout champ non déclaré ici fait échouer la requête,
 * ce qui interdit de glisser un thème par un chemin détourné.
 */
export class DrawWordsDto {
  @IsIn([...MODE_IDS], { message: 'Mode de jeu inconnu.' })
  mode!: ModeId;

  /** Facultatif : sans thème, la partie se joue en « Tous horizons ». */
  @IsOptional()
  @IsIn([...THEME_IDS], { message: 'Thème inconnu.' })
  theme?: ThemeId;
}
