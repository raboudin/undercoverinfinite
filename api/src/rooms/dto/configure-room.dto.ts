import { IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';
import {
  MODE_IDS,
  THEME_IDS,
  type ModeId,
  type ThemeId,
} from '../../entitlements/catalog';
import {
  MAX_PLAYERS,
  MAX_TIMER_SECONDS,
  MIN_TIMER_SECONDS,
} from '../engine/validate';

/** Événement socket `room:configure`, hôte uniquement, phase `lobby`. */
export class ConfigureRoomDto {
  @IsOptional()
  @IsIn([...MODE_IDS], { message: 'Mode de jeu inconnu.' })
  mode?: ModeId;

  @IsOptional()
  @IsIn([...THEME_IDS], { message: 'Thème inconnu.' })
  theme?: ThemeId;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PLAYERS)
  undercoverCount?: number;

  @IsOptional()
  @IsInt()
  @Min(MIN_TIMER_SECONDS)
  @Max(MAX_TIMER_SECONDS)
  timerSeconds?: number;
}
