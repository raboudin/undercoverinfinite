import {
  ExecutionContext,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Observable } from 'rxjs';
import { AUTH_CONFIG, type AuthConfig } from '../auth.config';

/**
 * Les stratégies OAuth ne sont enregistrées que si leurs credentials sont
 * présents. Sans ce garde-fou, appeler `/auth/google` sur un serveur non
 * configuré donnerait un 500 « Unknown authentication strategy » ; on répond
 * un 503 explicite à la place.
 */
@Injectable()
export class GoogleOAuthGuard extends AuthGuard('google') {
  constructor(@Inject(AUTH_CONFIG) private readonly config: AuthConfig) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    if (!this.config.oauth.google) {
      throw new ServiceUnavailableException(
        "La connexion Google n'est pas configurée sur ce serveur.",
      );
    }
    return super.canActivate(context);
  }
}

@Injectable()
export class FacebookOAuthGuard extends AuthGuard('facebook') {
  constructor(@Inject(AUTH_CONFIG) private readonly config: AuthConfig) {
    super();
  }

  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    if (!this.config.oauth.facebook) {
      throw new ServiceUnavailableException(
        "La connexion Facebook n'est pas configurée sur ce serveur.",
      );
    }
    return super.canActivate(context);
  }
}
