import { MAX_VOTE_ATTEMPTS, resolveVotes } from './voting';

describe('resolveVotes', () => {
  it('eliminates the clear majority target', () => {
    const result = resolveVotes(
      [{ targetId: 'a' }, { targetId: 'a' }, { targetId: 'b' }],
      1,
    );
    expect(result).toEqual({ outcome: 'eliminate', targetId: 'a', wasRandomTiebreak: false });
  });

  it('returns a tie between two targets when attempt is below the cap', () => {
    const result = resolveVotes([{ targetId: 'a' }, { targetId: 'b' }], 1);
    expect(result.outcome).toBe('tie');
    if (result.outcome === 'tie') {
      expect(result.tiedPlayerIds.sort()).toEqual(['a', 'b']);
    }
  });

  it('returns a tie between three targets when attempt is below the cap', () => {
    const result = resolveVotes(
      [{ targetId: 'a' }, { targetId: 'b' }, { targetId: 'c' }],
      MAX_VOTE_ATTEMPTS - 1,
    );
    expect(result.outcome).toBe('tie');
    if (result.outcome === 'tie') {
      expect(result.tiedPlayerIds.sort()).toEqual(['a', 'b', 'c']);
    }
  });

  it('forces a random tiebreak once the attempt cap is reached', () => {
    const result = resolveVotes(
      [{ targetId: 'a' }, { targetId: 'b' }],
      MAX_VOTE_ATTEMPTS,
      () => 0.9,
    );
    expect(result).toEqual({ outcome: 'eliminate', targetId: 'b', wasRandomTiebreak: true });
  });

  it('picks the first tied candidate when rng returns 0', () => {
    const result = resolveVotes(
      [{ targetId: 'a' }, { targetId: 'b' }, { targetId: 'c' }],
      MAX_VOTE_ATTEMPTS,
      () => 0,
    );
    expect(result).toEqual({ outcome: 'eliminate', targetId: 'a', wasRandomTiebreak: true });
  });

  it('never returns a tie past the attempt cap, even with many candidates', () => {
    const votes = [
      { targetId: 'a' },
      { targetId: 'b' },
      { targetId: 'c' },
      { targetId: 'd' },
    ];
    const result = resolveVotes(votes, MAX_VOTE_ATTEMPTS + 5, () => 0.5);
    expect(result.outcome).toBe('eliminate');
  });
});
