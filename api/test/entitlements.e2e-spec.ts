import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/app.setup';
import { PrismaService } from './../src/prisma/prisma.service';

/**
 * Droits et packs sur une vraie base. C'est le seul niveau où l'on voit le
 * cookie d'appareil réellement posé, et où les guards (session facultative
 * côté jeu, session obligatoire côté déblocage) sont ceux de la production.
 *
 * Prérequis : `docker compose up -d postgres` et un `DATABASE_URL` valide.
 */
const EMAIL = `e2e-packs-${Date.now()}@undercover.test`;
const PASSWORD = 'motdepasse-e2e-solide';

function setCookieHeaders(res: request.Response): string[] {
  const headers = res.headers as Record<string, string | string[] | undefined>;
  const raw = headers['set-cookie'];
  if (!raw) return [];
  return Array.isArray(raw) ? raw : [raw];
}

/** Cookies d'une réponse, sous la forme que renverrait le navigateur. */
function cookiesOf(res: request.Response): string[] {
  return setCookieHeaders(res).map((value) => value.split(';')[0]);
}

interface EntitlementsBody {
  account: boolean;
  packs: string[];
  modes: string[];
  themes: string[];
  credits: {
    dailyLimit: number;
    dailyUsed: number;
    dailyRemaining: number;
    wallet: number;
    remaining: number;
    unlimited: boolean;
    resetsOn: string;
  };
}

describe('Entitlements (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  /** Cookies de session du compte de test. */
  let authCookies: string[] = [];
  let userId = '';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    // Le compte est créé ici : il repart avec, entitlements et usage compris
    // (cascade sur `users`). La base de dev ne doit rien garder du test.
    if (userId) {
      await prisma.dailyUsage.deleteMany({
        where: { subject: `user:${userId}` },
      });
      await prisma.user
        .delete({ where: { id: userId } })
        .catch(() => undefined);
    }
    await app.close();
  });

  describe('sans compte', () => {
    it('sert le catalogue à tout le monde', async () => {
      const res = await request(app.getHttpServer()).get('/packs').expect(200);

      const body = res.body as {
        packs: { id: string }[];
        modes: unknown[];
        themes: { id: string; tagline: string; prompt?: string }[];
      };
      expect(body.packs.map((pack) => pack.id)).toEqual([
        'credits20',
        'unlimited',
        'discover',
        'diamond',
        'infinite',
      ]);
      // La vitrine plein écran affiche un thème par page : elle a besoin d'une
      // accroche, que seul le serveur connaît.
      expect(body.themes.every((theme) => theme.tagline.length > 0)).toBe(true);
      // Le prompt de chaque thème est un détail serveur : il ne sort jamais.
      expect(body.themes.every((theme) => theme.prompt === undefined)).toBe(
        true,
      );
      expect(JSON.stringify(res.body)).not.toContain('Registre');
    });

    it('pose un cookie d’appareil pour accrocher le quota anonyme', async () => {
      const res = await request(app.getHttpServer())
        .get('/entitlements')
        .expect(200);

      const device = setCookieHeaders(res).find((value) =>
        value.startsWith('device_id='),
      );
      expect(device).toBeDefined();
      // Le client n'a aucune raison de lire cette valeur.
      expect(device).toContain('HttpOnly');
    });

    it('n’ouvre que le mode classique et les thèmes généralistes', async () => {
      const res = await request(app.getHttpServer())
        .get('/entitlements')
        .expect(200);

      const body = res.body as EntitlementsBody;
      expect(body.account).toBe(false);
      expect(body.modes).toEqual(['classique']);
      expect(body.themes).toEqual([
        'general',
        'culture',
        'nature',
        'technologie',
      ]);
      expect(body.credits.dailyLimit).toBe(5);
    });

    it('refuse de rattacher un pack', async () => {
      await request(app.getHttpServer())
        .post('/packs/infinite/unlock')
        .expect(401);
    });

    it('refuse un mode réservé au compte', async () => {
      await request(app.getHttpServer())
        .post('/words/draw')
        .send({ mode: 'chrono' })
        .expect(403);
    });

    it('rejette un mode inconnu avant toute dépense', async () => {
      await request(app.getHttpServer())
        .post('/words/draw')
        .send({ mode: 'triche' })
        .expect(400);
    });

    it('rejette un champ non déclaré', async () => {
      await request(app.getHttpServer())
        .post('/words/draw')
        .send({ mode: 'classique', dailyLimit: 9999 })
        .expect(400);
    });
  });

  describe('avec un compte', () => {
    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: EMAIL, password: PASSWORD })
        .expect(201);

      authCookies = cookiesOf(res);
      userId = (res.body as { user: { id: string } }).user.id;
    });

    it('ajoute le chrono au socle, sans toucher au quota', async () => {
      const res = await request(app.getHttpServer())
        .get('/entitlements')
        .set('Cookie', authCookies)
        .expect(200);

      const body = res.body as EntitlementsBody;
      expect(body.account).toBe(true);
      expect(body.modes).toEqual(['classique', 'chrono']);
      expect(body.credits.dailyLimit).toBe(5);
      expect(body.credits.wallet).toBe(0);
    });

    it('rattache un pack et ouvre ce qu’il promet', async () => {
      const res = await request(app.getHttpServer())
        .post('/packs/diamond/unlock')
        .set('Cookie', authCookies)
        .expect(201);

      const body = res.body as EntitlementsBody;
      expect(body.packs).toEqual(['diamond']);
      expect(body.modes).toEqual(['classique', 'chrono', 'hot', 'defi']);
      expect(body.themes).toHaveLength(9);
      expect(body.credits.dailyLimit).toBe(50);
      expect(body.credits.unlimited).toBe(true);
    });

    it('refuse un second déblocage du même pack', async () => {
      await request(app.getHttpServer())
        .post('/packs/diamond/unlock')
        .set('Cookie', authCookies)
        .expect(409);
    });

    it('crédite la réserve d’un pack de recharge', async () => {
      const res = await request(app.getHttpServer())
        .post('/packs/credits20/unlock')
        .set('Cookie', authCookies)
        .expect(201);

      const body = res.body as EntitlementsBody;
      expect(body.credits.wallet).toBe(20);
      // Le solde acheté s'ajoute au quota du jour, il ne le remplace pas.
      expect(body.credits.remaining).toBe(70);
    });

    it('ignore un pack inconnu', async () => {
      await request(app.getHttpServer())
        .post('/packs/pack-fantome/unlock')
        .set('Cookie', authCookies)
        .expect(404);
    });

    it('refuse teams tant que ses règles ne sont pas écrites', async () => {
      await request(app.getHttpServer())
        .post('/packs/infinite/unlock')
        .set('Cookie', authCookies)
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/words/draw')
        .set('Cookie', authCookies)
        .send({ mode: 'teams' })
        .expect(403);

      expect((res.body as { message: string }).message).toContain(
        'pas encore ouvert',
      );
    });
  });
});
