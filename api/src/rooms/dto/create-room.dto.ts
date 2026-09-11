import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import {
  MODE_IDS,
  THEME_IDS,
  type ModeId,
  type ThemeId,
} from '../../entitlements/catalog';

/** Corps de `POST /rooms`. L'hôte choisit un nom d'affichage et, en option,
 * un mode/thème de départ (modifiables ensuite depuis le lobby). */
export class CreateRoomDto {
  @IsString()
  @Length(1, 24, { message: 'Le nom de code doit faire entre 1 et 24 caractères.' })
  displayName!: string;

  @IsOptional()
  @IsIn([...MODE_IDS], { message: 'Mode de jeu inconnu.' })
  mode?: ModeId;

  @IsOptional()
  @IsIn([...THEME_IDS], { message: 'Thème inconnu.' })
  theme?: ThemeId;
}
