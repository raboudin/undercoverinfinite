/**
 * Le « jour » du jeu — la frontière de remise à zéro des crédits — suit ce
 * fuseau, et pas l'heure du serveur : un joueur français doit retrouver ses
 * parties à minuit chez lui, quel que soit l'endroit où tourne l'API.
 */
export const GAME_TIMEZONE = 'Europe/Paris';

/** Date du jour au format `YYYY-MM-DD` dans le fuseau du jeu. */
export function todayKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: GAME_TIMEZONE }).format(
    now,
  );
}

/**
 * Clé de jour → `Date` pour une colonne `@db.Date`. Prisma n'en retient que la
 * partie date en UTC : la borner à minuit UTC évite qu'un décalage local
 * fasse basculer la ligne d'un jour à l'autre.
 */
export function dayDate(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

/** Lendemain de `key`, pour annoncer au joueur quand ses crédits reviennent. */
export function nextDayKey(key: string): string {
  const next = dayDate(key);
  next.setUTCDate(next.getUTCDate() + 1);
  return next.toISOString().slice(0, 10);
}
