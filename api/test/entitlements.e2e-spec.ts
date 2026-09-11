import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';

/**
 * Catalogue de thèmes et de difficultés sur une vraie base. Le jeu est
 * entièrement gratuit et ne connaît qu'un seul mode (Classique) : cette
 * réponse est la même pour un anonyme ou un compte, sans notion de droits.
 *
 * Prérequis : `docker compose up -d postgres` et un `DATABASE_URL` valide.
 */

function setCookieHeaders(res: request.Response): string[] {
  const headers = res.headers as Record<string, string | string[] | undefined>;
  const raw = headers['set-cookie'];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

interface EntitlementsBody {
  themes: { id: string; label: string; tagline: string; prompt?: string }[];
  difficulties: { id: string; level: number; label: string; tagline: string; prompt?: string }[];
}

describe('Entitlements (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('sert le catalogue des thèmes et des difficultés à tout le monde', async () => {
    const res = await request(app.getHttpServer())
      .get('/entitlements')
      .expect(200);

    const body = res.body as EntitlementsBody;
    expect(body.themes).toEqual([
      'general',
      'culture',
      'nature',
      'technologie',
      'personnalites',
      'pop-culture',
      'football',
      'pays-etats',
      'histoire-arts',
    ].map((id) => expect.objectContaining({ id })));
    expect(body.difficulties).toEqual([
      'evident',
      'facile',
      'normal',
      'difficile',
      'farfelu',
    ].map((id) => expect.objectContaining({ id })));

    // La vitrine plein écran affiche un thème par page : elle a besoin d'une
    // accroche, que seul le serveur connaît.
    expect(body.themes.every((theme) => theme.tagline.length > 0)).toBe(true);
    // Le prompt LLM d'un thème ou d'une difficulté est un détail serveur : il ne sort jamais.
    expect(body.themes.every((theme) => theme.prompt === undefined)).toBe(true);
    expect(body.difficulties.every((d) => d.prompt === undefined)).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain('Registre');
  });

  it('ne pose aucun cookie — il n’y a plus de notion de droits par sujet', async () => {
    const res = await request(app.getHttpServer())
      .get('/entitlements')
      .expect(200);

    expect(setCookieHeaders(res)).toEqual([]);
  });

  describe('POST /words/draw', () => {
    it('sert une partie sans compte et pose un cookie d’appareil', async () => {
      const res = await request(app.getHttpServer())
        .post('/words/draw')
        .send({})
        .expect(200);

      const body = res.body as { pair: { a: string; b: string } };
      expect(body.pair.a).not.toBe(body.pair.b);

      const device = setCookieHeaders(res).find((value) =>
        value.startsWith('device_id='),
      );
      expect(device).toBeDefined();
      expect(device).toContain('HttpOnly');
    });

    it('rejette un thème inconnu avant toute génération', async () => {
      await request(app.getHttpServer())
        .post('/words/draw')
        .send({ theme: 'triche' })
        .expect(400);
    });

    it('rejette une difficulté inconnue', async () => {
      await request(app.getHttpServer())
        .post('/words/draw')
        .send({ difficulty: 'extreme' })
        .expect(400);
    });

    it('rejette un champ non déclaré', async () => {
      await request(app.getHttpServer())
        .post('/words/draw')
        .send({ theme: 'general', mode: 'classique' })
        .expect(400);
    });
  });
});
