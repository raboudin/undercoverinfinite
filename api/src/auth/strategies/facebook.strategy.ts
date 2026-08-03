import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, type Profile } from 'passport-facebook';
import { AUTH_CONFIG, type AuthConfig } from '../auth.config';
import type { OAuthProfile } from '../auth.types';

/** Voir GoogleStrategy : enregistrée seulement si les credentials existent. */
@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(@Inject(AUTH_CONFIG) config: AuthConfig) {
    const facebook = config.oauth.facebook;
    if (!facebook) {
      throw new Error(
        'FacebookStrategy instanciée sans configuration OAuth Facebook.',
      );
    }
    super({
      clientID: facebook.clientID,
      clientSecret: facebook.clientSecret,
      callbackURL: facebook.callbackURL,
      scope: ['email'],
      // Sans `profileFields`, l'API Graph ne renvoie que l'id et le nom.
      profileFields: ['id', 'emails', 'displayName'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ): OAuthProfile {
    return {
      provider: 'facebook',
      providerId: profile.id,
      email: profile.emails?.[0]?.value ?? null,
      // Facebook ne divulgue une adresse que confirmée côté compte ; il n'y a
      // pas d'équivalent d'`email_verified` à interroger.
      emailVerified: true,
      displayName: profile.displayName || null,
    };
  }
}
