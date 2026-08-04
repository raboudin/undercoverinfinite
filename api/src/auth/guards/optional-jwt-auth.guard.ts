import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Attache l'utilisateur à `req.user` si le cookie d'access token est valide, et
 * laisse passer sinon.
 *
 * `JwtAuthGuard` répond 401 dès que le cookie manque : inutilisable sur les
 * routes de jeu, qui doivent rester ouvertes aux joueurs sans compte tout en
 * reconnaissant ceux qui en ont un (leurs packs et leur quota en dépendent).
 * C'est `handleRequest` qui lève par défaut — le neutraliser suffit, la
 * validation du token reste inchangée.
 */
@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  handleRequest<TUser>(_error: unknown, user: TUser | false): TUser | null {
    return user === false || user === undefined ? null : user;
  }
}
