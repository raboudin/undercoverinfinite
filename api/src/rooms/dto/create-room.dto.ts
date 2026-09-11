import { IsBoolean, IsIn, IsOptional, IsString, Length } from 'class-validator';
import {
  DIFFICULTY_IDS,
  THEME_IDS,
  type DifficultyId,
  type ThemeId,
} from '../../entitlements/catalog';

/** Corps de `POST /rooms`. L'hôte choisit un nom d'affichage et, en option,
 * un thème/registre/difficulté de départ (modifiables ensuite depuis le lobby). */
export class CreateRoomDto {
  @IsString()
  @Length(1, 24, { message: 'Le nom de code doit faire entre 1 et 24 caractères.' })
  displayName!: string;

  @IsOptional()
  @IsIn([...THEME_IDS], { message: 'Thème inconnu.' })
  theme?: ThemeId;

  @IsOptional()
  @IsBoolean()
  spicy?: boolean;

  @IsOptional()
  @IsIn([...DIFFICULTY_IDS], { message: 'Difficulté inconnue.' })
  difficulty?: DifficultyId;
}
