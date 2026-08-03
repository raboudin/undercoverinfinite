import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { MAX_PASSWORD_LENGTH } from './register.dto';

/**
 * Pas de contrainte de robustesse ici : les règles de mot de passe peuvent
 * changer, les comptes déjà créés doivent continuer à se connecter.
 */
export class LoginDto {
  @IsEmail({}, { message: 'Adresse email invalide.' })
  @MaxLength(254)
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_PASSWORD_LENGTH)
  password: string;
}
