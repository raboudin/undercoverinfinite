import { dealRoles } from './deal';

/** RNG déterministe : renvoie la même séquence de valeurs à chaque appel. */
function sequence(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length]!;
}

describe('dealRoles', () => {
  it('assigns exactly undercoverCount undercovers and the rest civils', () => {
    const ids = ['p1', 'p2', 'p3', 'p4', 'p5'];
    const assignments = dealRoles(ids, 2, { a: 'Café', b: 'Thé' }, sequence([0.9, 0.1, 0.2, 0.3, 0.4, 0.5]));

    expect(assignments).toHaveLength(5);
    expect(assignments.filter((a) => a.role === 'undercover')).toHaveLength(2);
    expect(assignments.filter((a) => a.role === 'civil')).toHaveLength(3);
  });

  it('assigns seats matching input order', () => {
    const ids = ['p1', 'p2', 'p3'];
    const assignments = dealRoles(ids, 1, { a: 'Café', b: 'Thé' }, sequence([0.9]));
    expect(assignments.map((a) => a.seat)).toEqual([0, 1, 2]);
    expect(assignments.map((a) => a.playerId)).toEqual(ids);
  });

  it('gives every undercover the same word and every civil the other', () => {
    const ids = ['p1', 'p2', 'p3', 'p4'];
    const assignments = dealRoles(ids, 2, { a: 'Café', b: 'Thé' }, sequence([0.9, 0.1, 0.2, 0.3]));

    const undercoverWords = new Set(
      assignments.filter((a) => a.role === 'undercover').map((a) => a.word),
    );
    const civilWords = new Set(assignments.filter((a) => a.role === 'civil').map((a) => a.word));

    expect(undercoverWords.size).toBe(1);
    expect(civilWords.size).toBe(1);
    expect([...undercoverWords][0]).not.toBe([...civilWords][0]);
  });

  it('coin-flips which side of the pair the civils get', () => {
    const ids = ['p1', 'p2'];

    // rng() < 0.5 -> civils take `a`
    const civilsTakeA = dealRoles(ids, 1, { a: 'Café', b: 'Thé' }, sequence([0.1, 0.9]));
    const civil = civilsTakeA.find((a) => a.role === 'civil')!;
    expect(civil.word).toBe('Café');

    // rng() >= 0.5 -> civils take `b`
    const civilsTakeB = dealRoles(ids, 1, { a: 'Café', b: 'Thé' }, sequence([0.9, 0.9]));
    const civilB = civilsTakeB.find((a) => a.role === 'civil')!;
    expect(civilB.word).toBe('Thé');
  });

  it('is deterministic for a given rng', () => {
    const ids = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];
    const rng = () => 0.5;
    const first = dealRoles(ids, 2, { a: 'A', b: 'B' }, rng);
    const second = dealRoles([...ids], 2, { a: 'A', b: 'B' }, () => 0.5);
    expect(first).toEqual(second);
  });
});
