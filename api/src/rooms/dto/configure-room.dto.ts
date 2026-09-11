import { IsBoolean, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  DIFFICULTY_IDS,
  THEME_IDS,
  type DifficultyId,
  type ThemeId,
} from '../../entitlements/catalog';
import { MAX_PLAYERS } from '../engine/validate';

/** Événement socket `room:configure`, hôte uniquement, phase `lobby`. */
export class ConfigureRoomDto {
  @IsOptional()
  @IsIn([...THEME_IDS], { message: 'Thème inconnu.' })
  theme?: ThemeId;

  @IsOptional()
  @IsBoolean()
  spicy?: boolean;

  @IsOptional()
  @IsIn([...DIFFICULTY_IDS], { message: 'Difficulté inconnue.' })
  difficulty?: DifficultyId;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PLAYERS)
  undercoverCount?: number;
}
