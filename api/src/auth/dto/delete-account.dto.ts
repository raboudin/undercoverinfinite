import { IsOptional, IsString, MaxLength } from 'class-validator';
import { MAX_PASSWORD_LENGTH } from './register.dto';

export class DeleteAccountDto {
  /**
   * Mot de passe courant, exigé dès que le compte en a un : une session ouverte
   * sur un téléphone posé sur la table ne doit pas suffire à effacer le
   * dossier. Un compte né d'un OAuth n'a pas de mot de passe à redonner — la
   * session y fait seule autorité, et le front y demande une confirmation
   * saisie à la main.
   */
  @IsOptional()
  @IsString()
  @MaxLength(MAX_PASSWORD_LENGTH)
  password?: string;
}
