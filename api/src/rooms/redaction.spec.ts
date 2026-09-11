import { redactPlayer, redactPlayers, type RoomPlayerRow } from './redaction';

function player(overrides: Partial<RoomPlayerRow> = {}): RoomPlayerRow {
  return {
    id: 'p1',
    displayName: 'Agent 1',
    isHost: false,
    seat: 0,
    role: 'civil',
    word: 'Café',
    alive: true,
    hasSeenReveal: false,
    connected: true,
    ...overrides,
  };
}

describe('redactPlayer', () => {
  it('reveals role and word to the player themselves', () => {
    const p = player({ id: 'p1', role: 'undercover', word: 'Thé' });
    const result = redactPlayer(p, 'p1', 'describe');
    expect(result.role).toBe('undercover');
    expect(result.word).toBe('Thé');
  });

  it('hides role and word from every other viewer while alive and mid-game', () => {
    const p = player({ id: 'p1', role: 'undercover', word: 'Thé', alive: true });
    const result = redactPlayer(p, 'p2', 'describe');
    expect(result.role).toBeNull();
    expect(result.word).toBeNull();
  });

  it('reveals role and word for an eliminated player to any viewer', () => {
    const p = player({ id: 'p1', role: 'undercover', word: 'Thé', alive: false });
    const result = redactPlayer(p, 'someone-else', 'describe');
    expect(result.role).toBe('undercover');
    expect(result.word).toBe('Thé');
  });

  it('reveals everything to everyone once the game reaches victory', () => {
    const p = player({ id: 'p1', role: 'undercover', word: 'Thé', alive: true });
    const result = redactPlayer(p, 'someone-else', 'victory');
    expect(result.role).toBe('undercover');
    expect(result.word).toBe('Thé');
  });

  it('never leaks role/word through public fields regardless of visibility', () => {
    const p = player({ role: 'undercover', word: 'Thé' });
    const result = redactPlayer(p, 'someone-else', 'lobby');
    expect(result).not.toHaveProperty('subjectKey');
    expect(result).not.toHaveProperty('playerTokenHash');
  });
});

describe('redactPlayers', () => {
  it('applies the same rule to a whole roster, per viewer', () => {
    const roster: RoomPlayerRow[] = [
      player({ id: 'p1', role: 'undercover', word: 'Thé', alive: true }),
      player({ id: 'p2', role: 'civil', word: 'Café', alive: true }),
      player({ id: 'p3', role: 'undercover', word: 'Thé', alive: false }),
    ];

    const asP2 = redactPlayers(roster, 'p2', 'describe');
    const p1View = asP2.find((p) => p.id === 'p1')!;
    const p2View = asP2.find((p) => p.id === 'p2')!;
    const p3View = asP2.find((p) => p.id === 'p3')!;

    expect(p1View.role).toBeNull(); // autre agent, vivant
    expect(p2View.role).toBe('civil'); // soi-même
    expect(p3View.role).toBe('undercover'); // éliminé
  });
});
