export interface RoomPlayerRow {
  id: string;
  displayName: string;
  isHost: boolean;
  seat: number | null;
  role: string | null;
  word: string | null;
  alive: boolean;
  hasSeenReveal: boolean;
  connected: boolean;
}

export interface RedactedPlayer {
  id: string;
  displayName: string;
  isHost: boolean;
  seat: number | null;
  alive: boolean;
  hasSeenReveal: boolean;
  connected: boolean;
  /** Masqué (`null`) sauf pour son propre siège, un agent éliminé, ou en victoire. */
  role: string | null;
  word: string | null;
}

/**
 * Seule barrière de secret de tout le mode en ligne : un agent voit son propre
 * rôle/mot, ceux d'un agent déjà éliminé (sa carte est retournée sur la table
 * pour tout le monde, comme en local), et tous les rôles/mots une fois la
 * partie en phase victoire (débriefing final). Le reste reste masqué.
 *
 * Cette fonction est le SEUL endroit qui décide de cette visibilité — le
 * gateway ne doit jamais diffuser une liste de joueurs non passée par elle.
 */
export function redactPlayer(
  player: RoomPlayerRow,
  viewerId: string,
  phase: string,
): RedactedPlayer {
  const reveal = player.id === viewerId || !player.alive || phase === 'victory';
  return {
    id: player.id,
    displayName: player.displayName,
    isHost: player.isHost,
    seat: player.seat,
    alive: player.alive,
    hasSeenReveal: player.hasSeenReveal,
    connected: player.connected,
    role: reveal ? player.role : null,
    word: reveal ? player.word : null,
  };
}

export function redactPlayers(
  players: RoomPlayerRow[],
  viewerId: string,
  phase: string,
): RedactedPlayer[] {
  return players.map((player) => redactPlayer(player, viewerId, phase));
}
