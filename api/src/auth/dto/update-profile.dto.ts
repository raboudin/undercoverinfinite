import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Aligné sur `RegisterDto.displayName`. */
export const MAX_DISPLAY_NAME_LENGTH = 60;

export class UpdateProfileDto {
  /**
   * Nom de code affiché. Une chaîne vide efface le nom (le compte retombe sur
   * la partie locale de son email) — d'où un champ optionnel plutôt que
   * nullable : `null` en JSON et `""` diraient la même chose, autant n'en
   * accepter qu'un.
   */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_DISPLAY_NAME_LENGTH, {
    message: `Le nom de code ne peut pas dépasser ${MAX_DISPLAY_NAME_LENGTH} caractères.`,
  })
  displayName?: string;
}
