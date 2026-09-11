import { DIFFICULTY_IDS, THEME_IDS } from './catalog';
import { EntitlementsService } from './entitlements.service';

describe('EntitlementsService', () => {
  const service = new EntitlementsService();

  describe('catalog', () => {
    it('liste tous les thèmes et paliers de difficulté du catalogue', () => {
      const catalog = service.catalog();

      expect(catalog.themes.map((theme) => theme.id)).toEqual([...THEME_IDS]);
      expect(catalog.difficulties.map((d) => d.id)).toEqual([...DIFFICULTY_IDS]);
    });

    it('ne fuit pas le prompt LLM des thèmes ni des difficultés', () => {
      const catalog = service.catalog();

      for (const theme of catalog.themes) {
        expect(theme).not.toHaveProperty('prompt');
      }
      for (const difficulty of catalog.difficulties) {
        expect(difficulty).not.toHaveProperty('prompt');
      }
    });
  });

  describe('resolve', () => {
    it('est identique au catalogue, quel que soit le sujet', () => {
      expect(service.resolve()).toEqual(service.catalog());
    });
  });
});
