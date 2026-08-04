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

/** PNG minimal : en-tête magique, suivi de deux octets quelconques. */
const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01,
]);
const PNG_DATA_URL = `data:image/png;base64,${PNG_BYTES.toString('base64')}`;

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
      user: {
        id: ANY_STRING,
        email: EMAIL,
        displayName: 'Agent e2e',
        avatarUpdatedAt: null,
        hasPassword: true,
      },
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

  it('change le nom de code et le rend sur la session', async () => {
    const res = await request(app.getHttpServer())
      .patch('/auth/me')
      .set('Cookie', cookieHeader(accessToken, refreshToken))
      .send({ displayName: '  Corbeau  ' })
      .expect(200);

    expect((res.body as { user: { displayName: string } }).user.displayName)
      // Espaces retirés au passage.
      .toBe('Corbeau');

    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Cookie', cookieHeader(accessToken, refreshToken))
      .expect(200);
    expect(
      (me.body as { user: { displayName: string } }).user.displayName,
    ).toBe('Corbeau');
  });

  it('refuse de modifier le dossier sans session', async () => {
    await request(app.getHttpServer())
      .patch('/auth/me')
      .send({ displayName: 'Intrus' })
      .expect(401);
  });

  it('dépose une photo de profil, la sert, puis la retire', async () => {
    const res = await request(app.getHttpServer())
      .put('/auth/me/avatar')
      .set('Cookie', cookieHeader(accessToken, refreshToken))
      .send({ data: PNG_DATA_URL })
      .expect(200);

    const { user } = res.body as {
      user: { id: string; avatarUpdatedAt: string };
    };
    // C'est cet horodatage que le front colle en `?v=` sur l'URL de la photo.
    expect(user.avatarUpdatedAt).toEqual(ANY_STRING);

    // La photo se lit sans session : c'est une image dans un `<img>`.
    const image = await request(app.getHttpServer())
      .get(`/auth/avatar/${user.id}`)
      .expect(200);
    expect(image.headers['content-type']).toContain('image/png');
    expect(image.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.from(image.body as Buffer).equals(PNG_BYTES)).toBe(true);

    const removed = await request(app.getHttpServer())
      .delete('/auth/me/avatar')
      .set('Cookie', cookieHeader(accessToken, refreshToken))
      .expect(200);
    expect(
      (removed.body as { user: { avatarUpdatedAt: null } }).user
        .avatarUpdatedAt,
    ).toBeNull();

    await request(app.getHttpServer())
      .get(`/auth/avatar/${user.id}`)
      .expect(404);
  });

  it('refuse une photo dont le contenu dément le type annoncé', async () => {
    const fake = `data:image/png;base64,${Buffer.from('<script>alert(1)</script>').toString('base64')}`;

    await request(app.getHttpServer())
      .put('/auth/me/avatar')
      .set('Cookie', cookieHeader(accessToken, refreshToken))
      .send({ data: fake })
      .expect(400);
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

  /**
   * Droit à l'effacement. Sur son propre compte, pour ne pas emporter celui
   * que les tests précédents se passent de main en main.
   */
  describe('suppression du compte (RGPD)', () => {
    const doomedEmail = `e2e-rgpd-${Date.now()}@undercover.test`;
    let cookies: string[];
    let userId: string;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: doomedEmail, password: PASSWORD })
        .expect(201);

      cookies = cookieHeader(
        cookieValue(res, 'access_token'),
        cookieValue(res, 'refresh_token'),
      );
      userId = (res.body as { user: { id: string } }).user.id;

      // De quoi vérifier que l'effacement emporte aussi ce qui ne part pas en
      // cascade : ces deux tables n'ont pas de clé étrangère vers `users`.
      await prisma.dailyUsage.create({
        data: {
          subject: `user:${userId}`,
          day: new Date('2026-08-04'),
          used: 3,
        },
      });
      await prisma.contentDraw.create({
        data: { subject: `user:${userId}`, kind: 'pair', refId: 'paire-e2e' },
      });
    });

    afterAll(async () => {
      await prisma.user.deleteMany({ where: { email: doomedEmail } });
      await prisma.dailyUsage.deleteMany({
        where: { subject: `user:${userId}` },
      });
      await prisma.contentDraw.deleteMany({
        where: { subject: `user:${userId}` },
      });
    });

    it('refuse la suppression sur un mauvais mot de passe', async () => {
      // Une session ouverte ne suffit pas : le mot de passe est réexigé.
      // 403 et non 401 — la session est valable, c'est la confirmation qui
      // échoue, et un 401 ferait rejouer la requête au front après rotation.
      await request(app.getHttpServer())
        .delete('/auth/me')
        .set('Cookie', cookies)
        .send({ password: 'pas-le-bon' })
        .expect(403);

      await request(app.getHttpServer())
        .delete('/auth/me')
        .set('Cookie', cookies)
        .send({})
        .expect(403);

      expect(await prisma.user.count({ where: { id: userId } })).toBe(1);
    });

    it('efface le compte, ses traces et la session', async () => {
      const res = await request(app.getHttpServer())
        .delete('/auth/me')
        .set('Cookie', cookies)
        .send({ password: PASSWORD })
        .expect(204);

      // Cookies vidés : l'onglet ne reste pas avec une session fantôme.
      expect(cookieValue(res, 'access_token')).toBe('');
      expect(cookieValue(res, 'refresh_token')).toBe('');

      expect(await prisma.user.count({ where: { id: userId } })).toBe(0);
      // Cascade depuis `users`.
      expect(await prisma.refreshToken.count({ where: { userId } })).toBe(0);
      // Et les deux tables que la cascade n'atteint pas.
      expect(
        await prisma.dailyUsage.count({ where: { subject: `user:${userId}` } }),
      ).toBe(0);
      expect(
        await prisma.contentDraw.count({
          where: { subject: `user:${userId}` },
        }),
      ).toBe(0);

      // Le token signé survit à son compte : la stratégie relit l'utilisateur
      // à chaque requête, c'est ce qui rend la session immédiatement morte.
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('Cookie', cookies)
        .expect(401);
    });
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
