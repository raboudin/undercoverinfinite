import { Logger, Module, type Provider } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AUTH_CONFIG, loadAuthConfig } from './auth.config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { FacebookStrategy } from './strategies/facebook.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TokenService } from './token.service';

/**
 * Les stratégies OAuth ne sont branchées que si leurs credentials existent :
 * `new GoogleStrategy(...)` sans `clientID` lève à la construction, ce qui
 * ferait échouer le démarrage de toute l'API (y compris `/words/today`) sur
 * un environnement qui n'utilise que le login classique.
 */
function configuredOAuthStrategies(): Provider[] {
  const config = loadAuthConfig();
  const logger = new Logger('AuthModule');
  const strategies: Provider[] = [];

  if (config.oauth.google) {
    strategies.push(GoogleStrategy);
  } else {
    logger.warn('Connexion Google désactivée (GOOGLE_CLIENT_ID absent).');
  }

  if (config.oauth.facebook) {
    strategies.push(FacebookStrategy);
  } else {
    logger.warn('Connexion Facebook désactivée (FACEBOOK_CLIENT_ID absent).');
  }

  return strategies;
}

@Module({
  imports: [
    PassportModule,
    // `expiresIn` en secondes : la config a déjà traduit `AUTH_ACCESS_TOKEN_TTL`.
    JwtModule.registerAsync({
      useFactory: () => {
        const config = loadAuthConfig();
        return {
          secret: config.jwtSecret,
          signOptions: { expiresIn: config.accessTokenTtlSeconds },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    { provide: AUTH_CONFIG, useFactory: loadAuthConfig },
    AuthService,
    TokenService,
    JwtStrategy,
    ...configuredOAuthStrategies(),
  ],
  exports: [AuthService, TokenService],
})
export class AuthModule {}
