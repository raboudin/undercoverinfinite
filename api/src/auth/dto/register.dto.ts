import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Longueur minimale du mot de passe — la robustesse vient de la longueur. */
export const MIN_PASSWORD_LENGTH = 10;

/**
 * Plafond volontaire : bcrypt ne considère de toute façon que les 72 premiers
 * octets, et hacher une chaîne arbitrairement longue offre un levier de déni
 * de service gratuit.
 */
export const MAX_PASSWORD_LENGTH = 72;

export class RegisterDto {
  @IsEmail({}, { message: 'Adresse email invalide.' })
  @MaxLength(254)
  email: string;

  @IsString()
  @MinLength(MIN_PASSWORD_LENGTH, {
    message: `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.`,
  })
  @MaxLength(MAX_PASSWORD_LENGTH)
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  displayName?: string;
}
