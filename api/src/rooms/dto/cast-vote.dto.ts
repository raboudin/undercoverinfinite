import { IsString } from 'class-validator';

/** Événement socket `vote:cast`. */
export class CastVoteDto {
  @IsString()
  targetPlayerId!: string;
}
