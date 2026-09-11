import {
  DEFAULT_DIFFICULTY,
  DIFFICULTIES,
  DIFFICULTY_IDS,
  THEME_IDS,
  difficultyFromLevel,
  difficultyLevel,
} from './catalog';

describe('difficultyLevel / difficultyFromLevel', () => {
  it('convertit chaque id en son niveau 1..5, et inversement', () => {
    for (const id of DIFFICULTY_IDS) {
      const level = difficultyLevel(id);
      expect(level).toBeGreaterThanOrEqual(1);
      expect(level).toBeLessThanOrEqual(5);
      expect(difficultyFromLevel(level)).toBe(id);
    }
  });

  it('retombe sur la difficulté par défaut pour un niveau hors bornes', () => {
    expect(difficultyFromLevel(0)).toBe(DEFAULT_DIFFICULTY);
    expect(difficultyFromLevel(42)).toBe(DEFAULT_DIFFICULTY);
  });

  it('« normal » est la difficulté par défaut, niveau 3', () => {
    expect(DEFAULT_DIFFICULTY).toBe('normal');
    expect(difficultyLevel('normal')).toBe(3);
  });
});

describe('catalogue', () => {
  it('expose 9 thèmes et 5 paliers de difficulté', () => {
    expect(THEME_IDS.length).toBe(9);
    expect(DIFFICULTY_IDS.length).toBe(5);
  });

  it('chaque difficulté porte une consigne de prompt non vide', () => {
    for (const id of DIFFICULTY_IDS) {
      expect(DIFFICULTIES[id].prompt.length).toBeGreaterThan(0);
    }
  });
});
