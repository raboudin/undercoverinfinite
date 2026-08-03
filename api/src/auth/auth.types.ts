/** Utilisateur tel qu'exposé au client — jamais de hash ni d'ids fournisseur. */
export interface PublicUser {
  id: string;
  email: string;
  displayName: string | null;
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
