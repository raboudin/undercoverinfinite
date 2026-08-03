import type { CookieOptions, Request, Response } from 'express';
import {
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE_PATH,
  type AuthConfig,
} from './auth.config';
import type { TokenPair } from './auth.types';

/**
 * Lecture typée d'un cookie : `Request.cookies` est un `any` côté @types/express,
 * on le cadre ici une bonne fois plutôt qu'à chaque appel.
 */
export function readCookie(req: Request, name: string): string | undefined {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  const value = cookies?.[name];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function baseOptions(config: AuthConfig): CookieOptions {
  return {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    domain: config.cookie.domain,
  };
}

/**
 * Pose les deux tokens en cookies httpOnly. Aucun token ne transite par le
 * corps JSON : c'est le seul canal de transmission au client.
 */
export function setAuthCookies(
  res: Response,
  tokens: TokenPair,
  config: AuthConfig,
): void {
  res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...baseOptions(config),
    path: '/',
    maxAge: config.accessTokenTtlSeconds * 1000,
  });
  res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...baseOptions(config),
    path: REFRESH_TOKEN_COOKIE_PATH,
    maxAge: config.refreshTokenTtlSeconds * 1000,
  });
}

/**
 * Efface les deux cookies. Les attributs (path, domain, sameSite, secure)
 * doivent correspondre à ceux de la pose, sinon le navigateur garde l'ancien
 * cookie à côté du cookie vidé.
 */
export function clearAuthCookies(res: Response, config: AuthConfig): void {
  res.clearCookie(ACCESS_TOKEN_COOKIE, { ...baseOptions(config), path: '/' });
  res.clearCookie(REFRESH_TOKEN_COOKIE, {
    ...baseOptions(config),
    path: REFRESH_TOKEN_COOKIE_PATH,
  });
}
