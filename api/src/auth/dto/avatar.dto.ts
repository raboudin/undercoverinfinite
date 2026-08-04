import { IsString, MaxLength, MinLength } from 'class-validator';
import { MAX_AVATAR_DATA_URL_LENGTH } from '../avatar';

export class AvatarDto {
  /**
   * Vignette carrée encodée en data URL (`data:image/webp;base64,…`), produite
   * par le navigateur. Le format et la taille réelle sont vérifiés au décodage
   * par `parseAvatarDataUrl` : ce `MaxLength` n'est qu'un garde en amont, pour
   * ne pas décoder 200 Ko de base64 avant de les refuser.
   */
  @IsString()
  @MinLength(1)
  @MaxLength(MAX_AVATAR_DATA_URL_LENGTH, {
    message: 'Image trop lourde.',
  })
  data: string;
}
