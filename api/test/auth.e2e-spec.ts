import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { PrismaService } from './../src/prisma/prisma.service';

/**
 * Parcours complet sur une vraie base : inscription, session par cookies,
 * rotation du refresh token et détection de rejeu. C'est le seul niveau où
 * l'on voit réellement les en-têtes `Set-Cookie` que recevra le navigateur.
 *
 * Prérequis : `docker compose up -d postgres` et un `DATABASE_URL` valide.
 */
const EMAIL = `e2e-${Date.now()}@undercover.test`;
const PASSWORD = 'motdepasse-e2e-solide';

/** En-têtes `Set-Cookie` bruts d'une réponse. */
function setCookieHeaders(res: request.Response): string[] {
  const headers = res.headers as Record<string, string | string[] | undefined>;
  const raw = headers['set-cookie'];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

function findSetCookie(res: request.Response, name: string): string {
  const cookie = setCookieHeaders(res).find((value) =>
    value.startsWith(`${name}=`),
  );
  if (!cookie) throw new Error(`Cookie "${name}" absent de la réponse`);
  return cookie;
}

/** Valeur d'un cookie, telle qu'elle serait renvoyée par le navigateur. */
function cookieValue(res: request.Response, name: string): string {
  return findSetCookie(res, name).split(';')[0].split('=').slice(1).join('=');
}

function cookieHeader(access: string, refresh: string): string[] {
  return [`access_token=${access}`, `refresh_token=${refresh}`];
}

/** `expect.any` renvoie un `any` : on le range en `unknown` pour le linter. */
const ANY_STRING: unknown = expect.any(String);

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let accessToken = '';
  let refreshToken = '';
  /** Token consommé par la rotation, rejoué plus bas pour tester la détection. */
  let consumedRefreshToken = '';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    // Mêmes réglages que le vrai serveur : cookie-parser, ValidationPipe, CORS.
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Cascade : supprimer l'utilisateur emporte ses refresh tokens.
    await prisma.user.deleteMany({ where: { email: EMAIL } });
    await app.close();
  });

  it('refuse une inscription au mot de passe trop court', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: EMAIL, password: 'court' })
      .expect(400);
  });

  it('refuse un champ non déclaré (whitelist du ValidationPipe)', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: EMAIL, password: PASSWORD, isAdmin: true })
      .expect(400);
  });

  it('inscrit et pose les deux tokens en cookies httpOnly', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: EMAIL, password: PASSWORD, displayName: 'Agent e2e' })
      .expect(201);

    const access = findSetCookie(res, 'access_token');
    const refresh = findSetCookie(res, 'refresh_token');

    expect(access).toMatch(/HttpOnly/i);
    expect(access).toMatch(/SameSite=Strict/i);
    expect(access).toMatch(/Path=\//);
    expect(refresh).toMatch(/HttpOnly/i);
    expect(refresh).toMatch(/SameSite=Strict/i);
    // Le refresh token n'est présenté qu'aux routes /auth.
    expect(refresh).toMatch(/Path=\/auth/i);

    // Aucun token dans le corps : uniquement l'utilisateur.
    const body = res.body as Record<string, unknown>;
    expect(body).toEqual({
      user: { id: ANY_STRING, email: EMAIL, displayName: 'Agent e2e' },
    });
    expect(JSON.stringify(body)).not.toContain(
      cookieValue(res, 'access_token'),
    );

    accessToken = cookieValue(res, 'access_token');
    refreshToken = cookieValue(res, 'refresh_token');
  });

  it('refuse un second compte sur le même email', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: EMAIL, password: PASSWORD })
      .expect(409);
  });

  it('rend le profil sur /auth/me grâce au cookie', async () => {
    const res = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookieHeader(accessToken, refreshToken))
      .expect(200);

    expect((res.body as { user: { email: string } }).user.email).toBe(EMAIL);
  });

  it('refuse /auth/me sans cookie', async () => {
    await request(app.getHttpServer()).get('/auth/me').expect(401);
  });

  it('refuse un access token lu dans l’en-tête Authorization', async () => {
    // La stratégie ne lit que le cookie : c'est ce qui rend le token
    // inutilisable même s'il fuitait vers du JS côté client.
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(401);
  });

  it('refuse un login au mauvais mot de passe', async () => {
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL, password: 'pas-le-bon-mot-de-passe' })
      .expect(401);
  });

  it('connecte avec le bon mot de passe et repose des cookies', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL.toUpperCase(), password: PASSWORD })
      .expect(200);

    accessToken = cookieValue(res, 'access_token');
    refreshToken = cookieValue(res, 'refresh_token');
    expect(refreshToken).toEqual(ANY_STRING);
  });

  it('fait tourner le refresh token et renvoie une paire neuve', async () => {
    consumedRefreshToken = refreshToken;

    const res = await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', cookieHeader(accessToken, refreshToken))
      .expect(200);

    accessToken = cookieValue(res, 'access_token');
    refreshToken = cookieValue(res, 'refresh_token');
    expect(refreshToken).not.toBe(consumedRefreshToken);

    // L'ancien est marqué révoqué, pas supprimé : c'est ce qui permet de
    // reconnaître un rejeu plus tard.
    const revoked = await prisma.refreshToken.count({
      where: { user: { email: EMAIL }, revokedAt: { not: null } },
    });
    expect(revoked).toBeGreaterThan(0);

    // Le nouveau token ouvre bien une session.
    await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookieHeader(accessToken, refreshToken))
      .expect(200);
  });

  it('coupe toutes les sessions quand un refresh token consommé est rejoué', async () => {
    // Rejeu du token que la rotation précédente a consommé.
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', cookieHeader(accessToken, consumedRefreshToken))
      .expect(401);

    // Sanction : même le token légitime en cours est révoqué — un vol de
    // cookie ne laisse pas l'attaquant et la victime coexister.
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', cookieHeader(accessToken, refreshToken))
      .expect(401);

    const alive = await prisma.refreshToken.count({
      where: { user: { email: EMAIL }, revokedAt: null },
    });
    expect(alive).toBe(0);
  });

  it('révoque la session au logout et vide les cookies', async () => {
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: EMAIL, password: PASSWORD })
      .expect(200);

    accessToken = cookieValue(login, 'access_token');
    refreshToken = cookieValue(login, 'refresh_token');

    const res = await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', cookieHeader(accessToken, refreshToken))
      .expect(204);

    // Cookies vidés côté navigateur…
    expect(cookieValue(res, 'access_token')).toBe('');
    expect(cookieValue(res, 'refresh_token')).toBe('');

    // …et session réellement morte côté serveur.
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .set('Cookie', cookieHeader(accessToken, refreshToken))
      .expect(401);
  });

  it('accepte un logout sans session en cours', async () => {
    await request(app.getHttpServer()).post('/auth/logout').expect(204);
  });

  it('annonce les fournisseurs sociaux réellement branchés', async () => {
    // Le front s'en sert pour ne pas afficher un bouton qui finirait en 503.
    const res = await request(app.getHttpServer())
      .get('/auth/providers')
      .expect(200);

    expect(res.body).toEqual({ google: false, facebook: false });
  });

  it('répond 503 sur /auth/google tant que Google n’est pas configuré', async () => {
    // Aucun GOOGLE_CLIENT_ID dans l'environnement de test : la route existe
    // mais annonce clairement qu'elle n'est pas branchée.
    await request(app.getHttpServer()).get('/auth/google').expect(503);
  });
});
