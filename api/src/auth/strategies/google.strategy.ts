import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type Profile } from 'passport-google-oauth20';
import { AUTH_CONFIG, type AuthConfig } from '../auth.config';
import type { OAuthProfile } from '../auth.types';

/**
 * Enregistrée seulement si `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` sont
 * définis (voir AuthModule) — la stratégie passport refuserait de s'instancier
 * sans, et ferait tomber le démarrage de l'API entière.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(@Inject(AUTH_CONFIG) config: AuthConfig) {
    const google = config.oauth.google;
    if (!google) {
      throw new Error(
        'GoogleStrategy instanciée sans configuration OAuth Google.',
      );
    }
    super({
      clientID: google.clientID,
      clientSecret: google.clientSecret,
      callbackURL: google.callbackURL,
      scope: ['email', 'profile'],
    });
  }

  /**
   * Normalise le profil Google. Rien n'est écrit en base ici : `AuthService`
   * décide seul de créer, lier ou refuser.
   */
  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): OAuthProfile {
    const email = profile.emails?.[0];
    return {
      provider: 'google',
      providerId: profile.id,
      email: email?.value ?? null,
      // `verified` reflète le `email_verified` de l'ID token Google ; certains
      // retours le sérialisent en chaîne, d'où la double comparaison.
      emailVerified:
        email?.verified === true || (email?.verified as unknown) === 'true',
      displayName: profile.displayName || null,
    };
  }
}
