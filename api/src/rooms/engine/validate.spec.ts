import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  maxUndercovers,
  validatePlayerCount,
  validateUndercoverCount,
} from './validate';

describe('maxUndercovers', () => {
  it('keeps civils strictly in the majority', () => {
    expect(maxUndercovers(3)).toBe(1);
    expect(maxUndercovers(4)).toBe(1);
    expect(maxUndercovers(5)).toBe(2);
    expect(maxUndercovers(12)).toBe(5);
  });
});

describe('validatePlayerCount', () => {
  it('accepts the documented range', () => {
    expect(validatePlayerCount(MIN_PLAYERS)).toBeNull();
    expect(validatePlayerCount(MAX_PLAYERS)).toBeNull();
  });

  it('rejects below the minimum or above the maximum', () => {
    expect(validatePlayerCount(MIN_PLAYERS - 1)).not.toBeNull();
    expect(validatePlayerCount(MAX_PLAYERS + 1)).not.toBeNull();
  });
});

describe('validateUndercoverCount', () => {
  it('accepts a count within the ceiling', () => {
    expect(validateUndercoverCount(5, 2)).toBeNull();
  });

  it('rejects zero or negative', () => {
    expect(validateUndercoverCount(5, 0)).not.toBeNull();
  });

  it('rejects above the ceiling (civils must stay a strict majority)', () => {
    expect(validateUndercoverCount(5, 3)).not.toBeNull();
  });
});
