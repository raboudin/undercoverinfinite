import { IsString, Length } from 'class-validator';

/** Corps de `POST /rooms/:code/join`. */
export class JoinRoomDto {
  @IsString()
  @Length(1, 24, { message: 'Le nom de code doit faire entre 1 et 24 caractères.' })
  displayName!: string;
}
