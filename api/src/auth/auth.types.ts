/** Utilisateur tel qu'exposé au client — jamais de hash ni d'ids fournisseur. */
export interface PublicUser {
  id: string;
  email: string;
  displayName: string | null;
  /**
   * Date de la dernière photo de profil, `null` s'il n'y en a pas. L'image
   * elle-même ne transite pas ici : elle se récupère sur
   * `GET /auth/avatar/:userId`, et cet horodatage sert de cache-buster à cette
   * URL. Renvoyer la vignette en base64 dans chaque `/auth/me` alourdirait la
   * lecture de session pour rien.
   */
  avatarUpdatedAt: string | null;
  /**
   * Le compte a-t-il un mot de passe (par opposition à un compte né d'un
   * OAuth) ? Le front en a besoin pour savoir s'il doit le redemander avant
   * une suppression — sans quoi un compte Google se retrouverait devant un
   * champ impossible à remplir.
   *
   * Ce booléen ne décrit que le titulaire de la session. Le jour où
   * `PublicUser` servira aussi à décrire *les autres* joueurs (lobby), il
   * faudra une projection distincte : il n'a rien à faire dans celle-là.
   */
  hasPassword: boolean;
}

/** Contenu signé de l'access token. */
export interface AccessTokenPayload {
  sub: string;
  email: string;
}

/** Ce que `JwtStrategy.validate` accroche à `req.user`. */
export type AuthenticatedUser = PublicUser;

export interface TokenPair {
  accessToken: string;
  /** Valeur opaque : seul son SHA-256 est stocké en base. */
  refreshToken: string;
}

export interface AuthResult {
  user: PublicUser;
  tokens: TokenPair;
}

export type OAuthProviderName = 'google' | 'facebook';

/** Profil normalisé produit par les stratégies Google/Facebook. */
export interface OAuthProfile {
  provider: OAuthProviderName;
  providerId: string;
  email: string | null;
  /**
   * Un email non vérifié ne doit jamais suffire à prendre la main sur un
   * compte existant : c'est la porte d'entrée classique du détournement de
   * compte par OAuth.
   */
  emailVerified: boolean;
  displayName: string | null;
}
