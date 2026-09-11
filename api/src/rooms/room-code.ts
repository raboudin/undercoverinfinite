import { randomInt } from 'node:crypto';

/**
 * Alphabet sans 0/O/1/I : un code lu à l'oral ou recopié à la main ne doit pas
 * dépendre de la police pour distinguer zéro de O, un de I.
 */
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const CODE_LENGTH = 6;

/**
 * Code court d'invitation. Purement aléatoire : l'unicité n'est pas garantie
 * ici, elle se joue en base (`Room.code @unique`) — c'est `RoomsService` qui
 * retente sur collision (`isUniqueViolation`), même idiome que les autres
 * créations à contrainte unique de cette API.
 */
export function generateRoomCode(): string {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[randomInt(ALPHABET.length)];
  }
  return code;
}
