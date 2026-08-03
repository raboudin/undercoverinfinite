/**
 * Violation de contrainte unique côté Prisma (`P2002`).
 *
 * Plusieurs services s'appuient dessus pour laisser la base arbitrer une course
 * plutôt que de lire avant d'écrire : la lecture préalable laisse toujours une
 * fenêtre entre la vérification et l'insertion, la contrainte non.
 */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
