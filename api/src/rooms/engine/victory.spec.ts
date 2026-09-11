import { checkVictory } from './victory';

describe('checkVictory', () => {
  it('gives civils the win once no undercover remains', () => {
    expect(checkVictory(0, 3)).toBe('civils');
  });

  it('gives undercovers the win once strictly more numerous than civils', () => {
    expect(checkVictory(2, 1)).toBe('undercovers');
  });

  it('keeps the game going on a tie', () => {
    expect(checkVictory(1, 1)).toBeNull();
  });

  it('keeps the game going while civils are still ahead', () => {
    expect(checkVictory(1, 2)).toBeNull();
  });
});
