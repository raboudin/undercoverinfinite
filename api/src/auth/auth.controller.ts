import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  AUTH_CONFIG,
  REFRESH_TOKEN_COOKIE,
  type AuthConfig,
} from './auth.config';
import { clearAuthCookies, readCookie, setAuthCookies } from './auth.cookies';
import { AuthService } from './auth.service';
import type {
  AuthResult,
  AuthenticatedUser,
  OAuthProfile,
  PublicUser,
} from './auth.types';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { FacebookOAuthGuard, GoogleOAuthGuard } from './guards/oauth.guards';

/** Corps de réponse : l'utilisateur, jamais les tokens (ils sont en cookies). */
interface SessionResponse {
  user: PublicUser;
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly auth: AuthService,
    @Inject(AUTH_CONFIG) private readonly config: AuthConfig,
  ) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponse> {
    return this.openSession(await this.auth.register(dto), res);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponse> {
    return this.openSession(await this.auth.login(dto), res);
  }

  /**
   * Rotation : consomme le refresh token du cookie et repose les deux cookies.
   * Le client n'a rien à transmettre, tout est dans le cookie `refresh_token`.
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponse> {
    const result = await this.auth.refresh(
      readCookie(req, REFRESH_TOKEN_COOKIE),
    );
    return this.openSession(result, res);
  }

  /** Révoque la session en base et vide les cookies. Idempotent. */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(readCookie(req, REFRESH_TOKEN_COOKIE));
    clearAuthCookies(res, this.config);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@CurrentUser() user: AuthenticatedUser): SessionResponse {
    return { user };
  }

  /**
   * Fournisseurs réellement branchés sur ce serveur. Public et sans secret :
   * le front s'en sert pour ne pas afficher un bouton « Continuer avec
   * Google » qui finirait sur un 503.
   */
  @Get('providers')
  providers(): Record<'google' | 'facebook', boolean> {
    return {
      google: this.config.oauth.google !== null,
      facebook: this.config.oauth.facebook !== null,
    };
  }

  @Get('google')
  @UseGuards(GoogleOAuthGuard)
  googleAuth(): void {
    // Jamais exécuté : le guard redirige vers l'écran de consentement Google.
  }

  @Get('google/callback')
  @UseGuards(GoogleOAuthGuard)
  async googleCallback(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.completeOAuth(req, res);
  }

  @Get('facebook')
  @UseGuards(FacebookOAuthGuard)
  facebookAuth(): void {
    // Idem : redirection gérée par le guard.
  }

  @Get('facebook/callback')
  @UseGuards(FacebookOAuthGuard)
  async facebookCallback(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.completeOAuth(req, res);
  }

  /**
   * Fin de parcours OAuth : mêmes tokens et mêmes cookies que le login
   * classique, puis retour au front. Une erreur ici ne doit pas afficher un
   * JSON 401 dans l'onglet de l'utilisateur — on redirige avec un `?error=`.
   */
  private async completeOAuth(req: Request, res: Response): Promise<void> {
    const profile = req.user as OAuthProfile | undefined;
    if (!profile) {
      res.redirect(this.failureUrl('oauth_failed'));
      return;
    }

    try {
      const result = await this.auth.loginWithOAuth(profile);
      setAuthCookies(res, result.tokens, this.config);
      res.redirect(this.config.oauth.successRedirect);
    } catch (error) {
      this.logger.warn(
        `Connexion ${profile.provider} refusée : ${error instanceof Error ? error.message : String(error)}`,
      );
      res.redirect(this.failureUrl('oauth_rejected'));
    }
  }

  private failureUrl(reason: string): string {
    const target = this.config.oauth.failureRedirect;
    try {
      const url = new URL(target);
      url.searchParams.set('error', reason);
      return url.toString();
    } catch {
      // URL de repli mal formée : mieux vaut rediriger sans détail que planter.
      return target;
    }
  }

  private openSession(result: AuthResult, res: Response): SessionResponse {
    setAuthCookies(res, result.tokens, this.config);
    return { user: result.user };
  }
}
