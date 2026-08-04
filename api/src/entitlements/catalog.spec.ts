import {
  FREE_DAILY_CREDITS,
  GENERALIST_THEMES,
  MODES,
  THEME_IDS,
  UNLIMITED_DAILY_CREDITS,
  knownPacks,
  resolveAccess,
} from './catalog';

describe('resolveAccess', () => {
  it('sans compte : le mode classique seul, thèmes généralistes, quota gratuit', () => {
    const access = resolveAccess({ hasAccount: false, packs: [] });

    expect(access.modes).toEqual(['classique']);
    expect(access.themes).toEqual(GENERALIST_THEMES);
    expect(access.dailyLimit).toBe(FREE_DAILY_CREDITS);
    expect(access.unlimited).toBe(false);
  });

  it('avec un compte : le chrono s’ajoute, le quota ne bouge pas', () => {
    const access = resolveAccess({ hasAccount: true, packs: [] });

    expect(access.modes).toEqual(['classique', 'chrono']);
    expect(access.dailyLimit).toBe(FREE_DAILY_CREDITS);
  });

  it('discover : chrono et hot, mais toujours les seuls thèmes généralistes', () => {
    const access = resolveAccess({ hasAccount: true, packs: ['discover'] });

    expect(access.modes).toEqual(['classique', 'chrono', 'hot']);
    expect(access.themes).toEqual(GENERALIST_THEMES);
    expect(access.unlimited).toBe(true);
    expect(access.dailyLimit).toBe(UNLIMITED_DAILY_CREDITS);
  });

  it('diamond : le défi et tous les thèmes', () => {
    const access = resolveAccess({ hasAccount: true, packs: ['diamond'] });

    expect(access.modes).toEqual(['classique', 'chrono', 'hot', 'defi']);
    expect(access.themes).toEqual([...THEME_IDS]);
  });

  it('infinite : tous les modes du catalogue', () => {
    const access = resolveAccess({ hasAccount: true, packs: ['infinite'] });

    expect(access.modes).toEqual([
      'classique',
      'chrono',
      'hot',
      'defi',
      'teams',
      'pari',
    ]);
    expect(access.themes).toEqual([...THEME_IDS]);
  });

  it('cumule les packs sans que l’ordre compte', () => {
    const one = resolveAccess({
      hasAccount: true,
      packs: ['discover', 'diamond'],
    });
    const other = resolveAccess({
      hasAccount: true,
      packs: ['diamond', 'discover'],
    });

    expect(one).toEqual(other);
    expect(one.themes).toEqual([...THEME_IDS]);
  });

  it('la recharge de crédits n’ouvre ni mode ni thème', () => {
    const withPack = resolveAccess({ hasAccount: true, packs: ['credits20'] });
    const without = resolveAccess({ hasAccount: true, packs: [] });

    expect(withPack.modes).toEqual(without.modes);
    expect(withPack.themes).toEqual(without.themes);
    expect(withPack.dailyLimit).toBe(FREE_DAILY_CREDITS);
  });

  it('le pack illimité relève le quota sans ouvrir de mode', () => {
    const access = resolveAccess({ hasAccount: true, packs: ['unlimited'] });

    expect(access.dailyLimit).toBe(UNLIMITED_DAILY_CREDITS);
    expect(access.modes).toEqual(['classique', 'chrono']);
  });

  it('un pack sans compte ne donne rien : c’est le compte qui le porte', () => {
    const access = resolveAccess({ hasAccount: false, packs: ['infinite'] });

    expect(access.modes).toEqual(['classique']);
    expect(access.themes).toEqual(GENERALIST_THEMES);
    expect(access.dailyLimit).toBe(FREE_DAILY_CREDITS);
  });

  it('teams est vendu mais pas encore jouable', () => {
    expect(
      resolveAccess({ hasAccount: true, packs: ['infinite'] }).modes,
    ).toContain('teams');
    expect(MODES.teams.available).toBe(false);
  });
});

describe('knownPacks', () => {
  it('ignore une ligne dont le pack a disparu du catalogue', () => {
    expect(knownPacks(['infinite', 'pack-retire', 'credits20'])).toEqual([
      'infinite',
      'credits20',
    ]);
  });
});
