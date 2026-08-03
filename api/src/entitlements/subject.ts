import { randomUUID } from 'node:crypto';
import type { CookieOptions, Request, Response } from 'express';
import type { AuthConfig } from '../auth/auth.config';
import { readCookie } from '../auth/auth.cookies';
import type { AuthenticatedUser } from '../auth/auth.types';

/**
 * Identifiant d'appareil pour les joueurs sans compte. Le quota gratuit doit
 * bien s'accrocher à quelque chose, et ce quelque chose ne peut pas être
 * l'adresse IP (un foyer, un réseau d'entreprise ou un partage de connexion
 * mettraient tout le monde dans le même seau).
 *
 * `httpOnly` : le client n'a jamais besoin de lire cette valeur, il se contente
 * de l'envoyer comme les cookies d'auth.
 */
export const DEVICE_COOKIE = 'device_id';

/** Un an : au-delà, l'anonyme repart avec un quota neuf, ce qui est acceptable. */
const DEVICE_COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

/**
 * À qui rattacher une consommation. Le préfixe évite qu'un identifiant
 * d'appareil puisse un jour entrer en collision avec un identifiant de compte.
 */
export interface Subject {
  key: string;
  userId: string | null;
}

export function userSubject(userId: string): Subject {
  return { key: `user:${userId}`, userId };
}

function deviceOptions(config: AuthConfig): CookieOptions {
  return {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    domain: config.cookie.domain,
    path: '/',
    maxAge: DEVICE_COOKIE_MAX_AGE_MS,
  };
}

/**
 * Sujet de la requête : le compte s'il y en a un, sinon l'appareil.
 *
 * Le cookie d'appareil est posé au passage quand il manque — c'est pourquoi la
 * fonction a besoin de la `Response` et ne peut pas être un simple décorateur
 * de paramètre en lecture seule.
 *
 * Un joueur qui se connecte bascule de `device:` à `user:` : sa consommation
 * anonyme du jour ne le suit pas. C'est assumé — le compte est le périmètre de
 * facturation, et le report compliquerait la reprise pour un gain nul.
 */
export function resolveSubject(
  req: Request,
  res: Response,
  config: AuthConfig,
): Subject {
  const user = req.user as AuthenticatedUser | undefined;
  if (user?.id) return userSubject(user.id);

  const existing = readCookie(req, DEVICE_COOKIE);
  if (existing) return { key: `device:${existing}`, userId: null };

  const deviceId = randomUUID();
  res.cookie(DEVICE_COOKIE, deviceId, deviceOptions(config));
  return { key: `device:${deviceId}`, userId: null };
}
