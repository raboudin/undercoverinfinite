import { BadRequestException } from '@nestjs/common';

/**
 * Plafond des octets **décodés** d'une photo de profil.
 *
 * 64 Kio n'est pas un chiffre rond au hasard : la photo arrive en base64 dans
 * un corps JSON, et Express plafonne celui-ci à 100 Ko par défaut. 64 Kio
 * décodés font ~87 400 caractères de base64, ce qui laisse de la marge sous
 * cette limite. Monter ce plafond sans relever aussi la limite du body parser
 * transformerait un dépassement en 413 opaque, avant même d'arriver ici.
 *
 * Le front réduit de toute façon l'image à une vignette carrée de 256 px, très
 * en dessous du plafond : celui-ci ne protège que contre un client hostile.
 */
export const MAX_AVATAR_BYTES = 64 * 1024;

/**
 * Longueur maximale de la chaîne `data:` acceptée par le DTO. Sert de garde en
 * amont du décodage : refuser 200 Ko de base64 avant de les décoder évite
 * d'allouer le tampon pour rien.
 */
export const MAX_AVATAR_DATA_URL_LENGTH = 90_000;

/**
 * Formats acceptés. Pas de SVG : c'est un document, il peut porter du script,
 * et on renvoie ces octets tels quels au navigateur.
 */
export const ALLOWED_AVATAR_MIME = [
  'image/webp',
  'image/jpeg',
  'image/png',
] as const;

export type AvatarMimeType = (typeof ALLOWED_AVATAR_MIME)[number];

export interface ParsedAvatar {
  mimeType: AvatarMimeType;
  bytes: Buffer;
}

const DATA_URL_PATTERN = /^data:([a-z0-9.+/-]+);base64,([A-Za-z0-9+/]+={0,2})$/;

function isAllowedMime(value: string): value is AvatarMimeType {
  return (ALLOWED_AVATAR_MIME as readonly string[]).includes(value);
}

/**
 * Le type déclaré dans la data URL est fourni par le client : on ne le croit
 * pas sur parole. Sans cette vérification, n'importe quels octets pourraient
 * être stockés puis resservis sous `Content-Type: image/png` — et un navigateur
 * qui renifle le contenu y verrait ce que l'auteur y a mis.
 */
function matchesMagicBytes(mimeType: AvatarMimeType, bytes: Buffer): boolean {
  switch (mimeType) {
    case 'image/png':
      return bytes
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'image/jpeg':
      return bytes.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]));
    case 'image/webp':
      // Conteneur RIFF : "RIFF" en tête, "WEBP" juste après la taille.
      return (
        bytes.length >= 12 &&
        bytes.subarray(0, 4).toString('latin1') === 'RIFF' &&
        bytes.subarray(8, 12).toString('latin1') === 'WEBP'
      );
  }
}

/**
 * Décode la vignette envoyée par le front (`data:image/webp;base64,…`).
 *
 * Toutes les erreurs sortent en 400 : c'est le client qui a mal formé sa
 * requête, et le message reste générique côté format pour ne pas transformer
 * l'endpoint en outil de sondage.
 */
export function parseAvatarDataUrl(input: string): ParsedAvatar {
  const match = DATA_URL_PATTERN.exec(input.trim());
  if (!match) {
    throw new BadRequestException(
      'Image illisible : une data URL base64 est attendue.',
    );
  }

  const [, mimeType, base64] = match;
  if (!isAllowedMime(mimeType)) {
    throw new BadRequestException(
      'Format non accepté : envoie une image WebP, JPEG ou PNG.',
    );
  }

  const bytes = Buffer.from(base64, 'base64');
  if (bytes.length === 0) {
    throw new BadRequestException('Image vide.');
  }
  if (bytes.length > MAX_AVATAR_BYTES) {
    throw new BadRequestException(
      `Image trop lourde : ${Math.round(MAX_AVATAR_BYTES / 1024)} Ko maximum.`,
    );
  }
  if (!matchesMagicBytes(mimeType, bytes)) {
    throw new BadRequestException(
      "Le contenu de l'image ne correspond pas au format annoncé.",
    );
  }

  return { mimeType, bytes };
}
