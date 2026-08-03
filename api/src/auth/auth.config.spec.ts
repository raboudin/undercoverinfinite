import {
  buildAuthConfig,
  parseDurationToSeconds,
  resetAuthConfigCache,
} from './auth.config';

const AUTH_ENV_VARS = [
  'AUTH_JWT_SECRET',
  'AUTH_ACCESS_TOKEN_TTL',
  'AUTH_REFRESH_TOKEN_TTL',
  'AUTH_COOKIE_SAME_SITE',
  'AUTH_COOKIE_SECURE',
  'AUTH_COOKIE_DOMAIN',
  'AUTH_OAUTH_SUCCESS_REDIRECT',
  'AUTH_OAUTH_FAILURE_REDIRECT',
  'AUTH_API_URL',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_CALLBACK_URL',
  'FACEBOOK_CLIENT_ID',
  'FACEBOOK_CLIENT_SECRET',
];

describe('auth.config', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    for (const name of AUTH_ENV_VARS) delete process.env[name];
    process.env.AUTH_JWT_SECRET = 'secret-de-test';
    resetAuthConfigCache();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('parseDurationToSeconds', () => {
    it('comprend les suffixes s/m/h/d', () => {
      expect(parseDurationToSeconds('45s', '1h', 'X')).toBe(45);
      expect(parseDurationToSeconds('30m', '1h', 'X')).toBe(1800);
      expect(parseDurationToSeconds('5h', '1h', 'X')).toBe(18000);
      expect(parseDurationToSeconds('30d', '1h', 'X')).toBe(2592000);
    });

    it('interprète un nombre nu en secondes', () => {
      expect(parseDurationToSeconds('90', '1h', 'X')).toBe(90);
    });

    it('retombe sur le défaut pour une valeur illisible', () => {
      expect(parseDurationToSeconds('bientôt', '5h', 'X')).toBe(18000);
      expect(parseDurationToSeconds('0h', '5h', 'X')).toBe(18000);
      expect(parseDurationToSeconds('-3h', '5h', 'X')).toBe(18000);
    });
  });

  describe('valeurs par défaut', () => {
    it('donne 5 h d’access token et 30 j de refresh token', () => {
      const config = buildAuthConfig();

      expect(config.accessTokenTtlSeconds).toBe(5 * 3600);
      expect(config.refreshTokenTtlSeconds).toBe(30 * 86400);
    });

    it('pose des cookies sameSite=strict, non secure hors production', () => {
      const config = buildAuthConfig();

      expect(config.cookie.sameSite).toBe('strict');
      expect(config.cookie.secure).toBe(false);
      expect(config.cookie.domain).toBeUndefined();
    });

    it('n’active aucun fournisseur OAuth sans credentials', () => {
      const config = buildAuthConfig();

      expect(config.oauth.google).toBeNull();
      expect(config.oauth.facebook).toBeNull();
    });
  });

  describe('cookies', () => {
    it('force secure quand sameSite=none, sinon le cookie serait rejeté', () => {
      process.env.AUTH_COOKIE_SAME_SITE = 'none';
      process.env.AUTH_COOKIE_SECURE = 'false';

      expect(buildAuthConfig().cookie.secure).toBe(true);
    });

    it('ignore une valeur sameSite inconnue au profit de strict', () => {
      process.env.AUTH_COOKIE_SAME_SITE = 'peut-être';

      expect(buildAuthConfig().cookie.sameSite).toBe('strict');
    });

    it('honore AUTH_COOKIE_SECURE en dev pour tester du HTTPS local', () => {
      process.env.AUTH_COOKIE_SECURE = 'true';

      expect(buildAuthConfig().cookie.secure).toBe(true);
    });
  });

  describe('OAuth', () => {
    it('active Google dès que la paire id/secret est complète', () => {
      process.env.GOOGLE_CLIENT_ID = 'id-google';
      process.env.GOOGLE_CLIENT_SECRET = 'secret-google';

      expect(buildAuthConfig().oauth.google).toEqual({
        clientID: 'id-google',
        clientSecret: 'secret-google',
        callbackURL: 'http://localhost:3001/auth/google/callback',
      });
    });

    it('laisse le fournisseur désactivé si le secret manque', () => {
      process.env.FACEBOOK_CLIENT_ID = 'id-facebook';

      expect(buildAuthConfig().oauth.facebook).toBeNull();
    });

    it('dérive l’URL de callback de AUTH_API_URL', () => {
      process.env.GOOGLE_CLIENT_ID = 'id-google';
      process.env.GOOGLE_CLIENT_SECRET = 'secret-google';
      process.env.AUTH_API_URL = 'https://api.undercoverinfinite.com';

      expect(buildAuthConfig().oauth.google?.callbackURL).toBe(
        'https://api.undercoverinfinite.com/auth/google/callback',
      );
    });

    it('renvoie l’échec vers la même page que le succès par défaut', () => {
      process.env.AUTH_OAUTH_SUCCESS_REDIRECT =
        'https://undercoverinfinite.com';

      const { oauth } = buildAuthConfig();
      expect(oauth.failureRedirect).toBe('https://undercoverinfinite.com');
    });
  });

  describe('secret JWT', () => {
    it('refuse de démarrer en production sans AUTH_JWT_SECRET', () => {
      delete process.env.AUTH_JWT_SECRET;
      const previous = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      try {
        expect(() => buildAuthConfig()).toThrow(/AUTH_JWT_SECRET/);
      } finally {
        process.env.NODE_ENV = previous;
      }
    });

    it('génère un secret éphémère hors production', () => {
      delete process.env.AUTH_JWT_SECRET;

      expect(buildAuthConfig().jwtSecret).toHaveLength(64);
    });
  });
});
