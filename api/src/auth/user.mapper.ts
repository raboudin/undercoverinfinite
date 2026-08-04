import type { PublicUser } from './auth.types';

/**
 * Forme minimale d'une ligne `users` pour en tirer un `PublicUser`.
 *
 * `avatar` est optionnel : les requêtes qui ne joignent pas la relation
 * (création de compte, par exemple) n'ont de toute façon pas de photo à
 * annoncer. Une propriété absente et une photo absente donnent le même
 * `avatarUpdatedAt: null`.
 */
export interface PublicUserRow {
  id: string;
  email: string;
  displayName: string | null;
  passwordHash?: string | null;
  avatar?: { updatedAt: Date } | null;
}

/**
 * Jointure à passer à toute lecture d'utilisateur destinée au client.
 *
 * Regroupée ici parce qu'elle doit être identique partout : une session lue par
 * `JwtStrategy` et la même session rendue après rotation du token ne peuvent
 * pas annoncer une photo différente.
 */
export const PUBLIC_USER_INCLUDE = {
  avatar: { select: { updatedAt: true } },
} as const;

export function toPublicUser(user: PublicUserRow): PublicUser {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUpdatedAt: user.avatar?.updatedAt.toISOString() ?? null,
    // Le hash lui-même ne sort évidemment jamais : seul son existence est dite.
    hasPassword: !!user.passwordHash,
  };
}
