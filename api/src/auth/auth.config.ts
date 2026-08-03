import { Logger } from '@nestjs/common';
import { randomBytes } from 'node:crypto';

/**
 * Noms des cookies porteurs des tokens. Ils sont httpOnly : le front ne les
 * lit jamais en JS, il se contente d'envoyer ses requêtes avec
 * `credentials: 'include'`.
 */
export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

/**
 * Le refresh token n'est présenté qu'aux routes qui en ont besoin
 * (`/auth/refresh` et `/auth/logout`) : inutile de le promener sur chaque
 * appel API, ça réduit sa surface d'exposition.
 */
export const REFRESH_TOKEN_COOKIE_PATH = '/auth';

/** Jeton d'injection de la config d'auth (résolue une fois au démarrage). */
export const AUTH_CONFIG = 'AUTH_CONFIG';

export type SameSite = 'strict' | 'lax' | 'none';

export interface OAuthProviderConfig {
  clientID: string;
  clientSecret: string;
  callbackURL: string;
}

export interface AuthConfig {
  jwtSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlSeconds: number;
  cookie: {
    secure: boolean;
    sameSite: SameSite;
    /** Non défini = cookie limité à l'hôte exact de l'API. */
    domain?: string;
  };
  oauth: {
    /** `null` quand le fournisseur n'est pas configuré : ses routes répondent 503. */
    google: OAuthProviderConfig | null;
    facebook: OAuthProviderConfig | null;
    successRedirect: string;
    failureRedirect: string;
  };
}

const logger = new Logger('AuthConfig');

export const DEFAULT_ACCESS_TOKEN_TTL = '5h';
export const DEFAULT_REFRESH_TOKEN_TTL = '30d';
const DEFAULT_FRONTEND_URL = 'http://localhost:3000';
const DEFAULT_API_URL = 'http://localhost:3001';

/** Lit une variable d'env en traitant vide/espaces comme absente. */
function env(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

/**
 * Durées écrites comme `5h`, `30m`, `45s`, `7d` — ou un nombre nu, interprété
 * en secondes. Une valeur illisible retombe sur le défaut avec un warning
 * plutôt que de faire planter le démarrage sur une coquille de `.env`.
 */
export function parseDurationToSeconds(
  value: string,
  fallback: string,
  varName: string,
): number {
  const parse = (raw: string): number | null => {
    const match = /^(\d+)\s*([smhd]?)$/i.exec(raw.trim());
    if (!match) return null;
    const amount = Number(match[1]);
    if (amount <= 0) return null;
    const unit = match[2].toLowerCase();
    const multiplier =
      unit === 'd' ? 86400 : unit === 'h' ? 3600 : unit === 'm' ? 60 : 1;
    return amount * multiplier;
  };

  const parsed = parse(value);
  if (parsed !== null) return parsed;
  logger.warn(`${varName}="${value}" illisible : retour au défaut ${fallback}`);
  return parse(fallback) ?? 0;
}

function resolveJwtSecret(): string {
  const secret = env('AUTH_JWT_SECRET');
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'AUTH_JWT_SECRET est obligatoire en production : sans elle, les access tokens ne seraient pas vérifiables entre deux redémarrages.',
    );
  }
  // Hors production, on ne bloque pas le démarrage (tests, première prise en
  // main) : secret éphémère, régénéré à chaque boot — les sessions ne
  // survivent donc pas à un redémarrage, ce qui est le rappel voulu.
  logger.warn(
    'AUTH_JWT_SECRET absente : secret aléatoire généré pour ce processus. Les sessions ne survivront pas au redémarrage.',
  );
  return randomBytes(32).toString('hex');
}

function resolveSameSite(): SameSite {
  const raw = env('AUTH_COOKIE_SAME_SITE')?.toLowerCase();
  if (raw === 'strict' || raw === 'lax' || raw === 'none') return raw;
  if (raw) {
    logger.warn(`AUTH_COOKIE_SAME_SITE="${raw}" inconnu : retour à "strict"`);
  }
  // `strict` convient tant que le front et l'API partagent le même domaine
  // enregistrable (localhost:3000 / localhost:3001 en dev,
  // *.undercoverinfinite.com en déploiement) — c'est le cas ici.
  return 'strict';
}

function resolveOAuthProvider(
  prefix: 'GOOGLE' | 'FACEBOOK',
  defaultCallbackPath: string,
): OAuthProviderConfig | null {
  const clientID = env(`${prefix}_CLIENT_ID`);
  const clientSecret = env(`${prefix}_CLIENT_SECRET`);
  if (!clientID || !clientSecret) {
    if (clientID || clientSecret) {
      logger.warn(
        `${prefix}_CLIENT_ID et ${prefix}_CLIENT_SECRET doivent être fournis ensemble : connexion ${prefix.toLowerCase()} désactivée.`,
      );
    }
    return null;
  }
  return {
    clientID,
    clientSecret,
    callbackURL:
      env(`${prefix}_CALLBACK_URL`) ??
      `${env('AUTH_API_URL') ?? DEFAULT_API_URL}${defaultCallbackPath}`,
  };
}

export function buildAuthConfig(): AuthConfig {
  const sameSite = resolveSameSite();
  const secureEnv = env('AUTH_COOKIE_SECURE');
  // `SameSite=None` n'a aucun sens sans `Secure` : les navigateurs rejettent
  // le cookie. On force plutôt que de laisser une config silencieusement cassée.
  const secure =
    sameSite === 'none' ||
    (secureEnv ? secureEnv === 'true' : process.env.NODE_ENV === 'production');

  const successRedirect =
    env('AUTH_OAUTH_SUCCESS_REDIRECT') ?? DEFAULT_FRONTEND_URL;

  return {
    jwtSecret: resolveJwtSecret(),
    accessTokenTtlSeconds: parseDurationToSeconds(
      env('AUTH_ACCESS_TOKEN_TTL') ?? DEFAULT_ACCESS_TOKEN_TTL,
      DEFAULT_ACCESS_TOKEN_TTL,
      'AUTH_ACCESS_TOKEN_TTL',
    ),
    refreshTokenTtlSeconds: parseDurationToSeconds(
      env('AUTH_REFRESH_TOKEN_TTL') ?? DEFAULT_REFRESH_TOKEN_TTL,
      DEFAULT_REFRESH_TOKEN_TTL,
      'AUTH_REFRESH_TOKEN_TTL',
    ),
    cookie: {
      secure,
      sameSite,
      domain: env('AUTH_COOKIE_DOMAIN'),
    },
    oauth: {
      google: resolveOAuthProvider('GOOGLE', '/auth/google/callback'),
      facebook: resolveOAuthProvider('FACEBOOK', '/auth/facebook/callback'),
      successRedirect,
      failureRedirect: env('AUTH_OAUTH_FAILURE_REDIRECT') ?? successRedirect,
    },
  };
}

let cached: AuthConfig | null = null;

/**
 * Config mémoïsée : `JwtModule`, les stratégies et le contrôleur doivent
 * partager exactement le même objet — notamment le secret aléatoire de dev,
 * qui serait sinon différent pour chacun.
 */
export function loadAuthConfig(): AuthConfig {
  cached ??= buildAuthConfig();
  return cached;
}

/** Tests uniquement : force une relecture de l'environnement. */
export function resetAuthConfigCache(): void {
  cached = null;
}
