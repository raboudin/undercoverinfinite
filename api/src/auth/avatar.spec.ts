import { BadRequestException } from '@nestjs/common';
import {
  ALLOWED_AVATAR_MIME,
  MAX_AVATAR_BYTES,
  parseAvatarDataUrl,
} from './avatar';

/** En-têtes réels des trois formats acceptés, complétés de quelques octets. */
const HEADERS: Record<string, number[]> = {
  'image/png': [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01],
  'image/jpeg': [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10],
  // RIFF....WEBP
  'image/webp': [
    0x52, 0x49, 0x46, 0x46, 0x10, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
  ],
};

function dataUrl(mimeType: string, bytes: Buffer): string {
  return `data:${mimeType};base64,${bytes.toString('base64')}`;
}

function sample(mimeType: string, extraBytes = 0): string {
  const header = Buffer.from(HEADERS[mimeType]);
  return dataUrl(
    mimeType,
    Buffer.concat([header, Buffer.alloc(extraBytes, 0x2a)]),
  );
}

describe('parseAvatarDataUrl', () => {
  it.each(ALLOWED_AVATAR_MIME)('accepte une image %s', (mimeType) => {
    const parsed = parseAvatarDataUrl(sample(mimeType));

    expect(parsed.mimeType).toBe(mimeType);
    expect(parsed.bytes.length).toBe(HEADERS[mimeType].length);
  });

  it('refuse ce qui n’est pas une data URL base64', () => {
    for (const input of [
      'https://exemple.test/photo.png',
      'data:image/png,pas-de-base64',
      'data:image/png;base64,',
      '',
    ]) {
      expect(() => parseAvatarDataUrl(input)).toThrow(BadRequestException);
    }
  });

  it('refuse un SVG, même bien formé', () => {
    // Un SVG est un document : il peut porter du script, et ces octets sont
    // resservis tels quels au navigateur.
    const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>');

    expect(() => parseAvatarDataUrl(dataUrl('image/svg+xml', svg))).toThrow(
      /WebP, JPEG ou PNG/,
    );
  });

  it('refuse un contenu qui dément le type annoncé', () => {
    // Le type vient du client : sans contrôle des octets d'en-tête, n'importe
    // quoi pourrait être stocké puis renvoyé sous `Content-Type: image/png`.
    const html = Buffer.from('<!doctype html><script>alert(1)</script>');

    expect(() => parseAvatarDataUrl(dataUrl('image/png', html))).toThrow(
      /ne correspond pas au format annoncé/,
    );
  });

  it('refuse un JPEG déguisé en PNG', () => {
    const jpeg = Buffer.from(HEADERS['image/jpeg']);

    expect(() => parseAvatarDataUrl(dataUrl('image/png', jpeg))).toThrow(
      BadRequestException,
    );
  });

  it('refuse une image au-delà du plafond', () => {
    expect(() =>
      parseAvatarDataUrl(sample('image/webp', MAX_AVATAR_BYTES)),
    ).toThrow(/trop lourde/);
  });

  it('accepte une image pile sous le plafond', () => {
    const filler = MAX_AVATAR_BYTES - HEADERS['image/webp'].length;

    expect(parseAvatarDataUrl(sample('image/webp', filler)).bytes.length).toBe(
      MAX_AVATAR_BYTES,
    );
  });
});
