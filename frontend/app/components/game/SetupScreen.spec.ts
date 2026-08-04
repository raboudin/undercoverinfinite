import { afterEach, describe, expect, it } from 'vitest'
import { DOMWrapper, mount } from '@vue/test-utils'
import SetupScreen from './SetupScreen.vue'
import ModeSelector from './ModeSelector.vue'
import ThemeButton from './ThemeButton.vue'
import ThemeCarousel from './ThemeCarousel.vue'
import GameTable from './GameTable.vue'
import ArtSlot from './ArtSlot.vue'
import Button from '../core/Button.vue'
import IconButton from '../core/IconButton.vue'
import RoleTag from '../core/RoleTag.vue'
import Card from '../data-display/Card.vue'
import Toast from '../feedback/Toast.vue'
import type { Credits, ModeCard, ThemeCard } from '../../composables/useEntitlements'

// La vitrine des thèmes est téléportée dans `body`.
afterEach(() => {
  document.body.innerHTML = ''
})

// Les composants du design system sont auto-importés par Nuxt ; en test
// unitaire il faut les enregistrer explicitement.
const global = {
  components: {
    Button, IconButton, Card, Toast, RoleTag,
    ModeSelector, ThemeButton, ThemeCarousel, GameTable, ArtSlot
  }
}

const ADD_PLAYER = '[aria-label="Ajouter un agent"]'
const REMOVE_PLAYER = '[aria-label="Retirer un agent"]'
const ADD_UNDERCOVER = '[aria-label="Ajouter un undercover"]'
const REMOVE_UNDERCOVER = '[aria-label="Retirer un undercover"]'
const ADD_TIME = '[aria-label="Augmenter le temps de parole"]'

const CREDITS: Credits = {
  dailyLimit: 5,
  dailyUsed: 2,
  dailyRemaining: 3,
  wallet: 0,
  remaining: 3,
  unlimited: false,
  resetsOn: '2026-08-04'
}

const MODES: ModeCard[] = [
  { id: 'classique', label: 'Classique', tagline: 'La mission d’origine.', available: true, unlocked: true, playable: true },
  { id: 'chrono', label: 'Chrono', tagline: 'Parole minutée.', available: true, unlocked: true, playable: true },
  { id: 'hot', label: 'Hot', tagline: 'Mots osés.', available: true, spicy: true, unlocked: true, playable: true },
  { id: 'teams', label: 'Teams', tagline: 'Deux équipes.', available: false, unlocked: true, playable: false },
  { id: 'pari', label: 'Pari risqué', tagline: 'Chacun mise.', available: true, unlocked: false, playable: false }
]

const THEMES: ThemeCard[] = [
  { id: 'general', label: 'Tous horizons', tagline: 'Tout le terrain.', generalist: true, unlocked: true },
  { id: 'culture', label: 'Culture', tagline: 'Livres et musique.', generalist: true, unlocked: true },
  { id: 'football', label: 'Football', tagline: 'Joueurs et clubs.', generalist: false, unlocked: false }
]

type Wrapper = ReturnType<typeof mount>

/** Écran prêt à jouer : droits chargés, crédits disponibles. Étape menu. */
function ready(props: Record<string, unknown> = {}) {
  return mount(SetupScreen, {
    props: { modes: MODES, themes: THEMES, credits: CREDITS, ...props },
    global
  })
}

function buttonNamed(wrapper: Wrapper, label: string) {
  return wrapper.findAllComponents(Button).find(button => button.text() === label)!
}

/** Passe du menu à la table. */
async function atTable(props: Record<string, unknown> = {}) {
  const wrapper = ready(props)
  await buttonNamed(wrapper, 'Dresser la table').trigger('click')
  return wrapper
}

/** Le bouton de lancement est toujours le dernier de l'écran. */
function launchButton(wrapper: Wrapper) {
  return wrapper.findAllComponents(Button).at(-1)!
}

/** Un nom par siège : on écrit, on passe au siège suivant. */
async function fillNames(wrapper: Wrapper, names: string[]) {
  const next = buttonNamed(wrapper, 'Siège suivant')
  for (const name of names) {
    await wrapper.get('input[type="text"]').setValue(name)
    await next.trigger('click')
  }
}

describe('SetupScreen — menu principal', () => {
  it('n’affiche que les modes et le dossier thématique', () => {
    const wrapper = ready()

    expect(wrapper.findComponent(ModeSelector).exists()).toBe(true)
    expect(wrapper.findComponent(ThemeButton).exists()).toBe(true)
    // Ni effectif, ni noms de code, ni mots : tout ça vit sur la table.
    expect(wrapper.find('input[type="text"]').exists()).toBe(false)
    expect(wrapper.find(ADD_UNDERCOVER).exists()).toBe(false)
    expect(wrapper.findComponent(GameTable).exists()).toBe(false)
  })

  it('résume le dossier thématique choisi sur son bouton', async () => {
    const wrapper = ready()
    expect(wrapper.findComponent(ThemeButton).text()).toContain('Tous horizons')

    await wrapper.findComponent(ThemeCarousel).vm.$emit('update:modelValue', 'culture')
    await wrapper.vm.$nextTick()

    expect(wrapper.findComponent(ThemeButton).text()).toContain('Culture')
  })

  it('ouvre la vitrine plein écran depuis le bouton', async () => {
    const wrapper = ready()
    expect(document.body.textContent).not.toContain('Tout le terrain.')

    await wrapper.findComponent(ThemeButton).get('button').trigger('click')

    expect(document.body.textContent).toContain('Tout le terrain.')
  })

  it('retire le dossier thématique en mode hot et prévient du registre', async () => {
    const wrapper = ready()
    expect(wrapper.text()).not.toContain('public adulte')

    await wrapper.findComponent(ModeSelector).vm.$emit('update:modelValue', 'hot')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('public adulte')
    expect(wrapper.findComponent(ThemeButton).exists()).toBe(false)
  })

  it('remonte un mode verrouillé vers la boutique', async () => {
    const wrapper = ready()
    await wrapper.findComponent(ModeSelector).vm.$emit('locked', 'pari')
    expect(wrapper.emitted('boutique')).toHaveLength(1)
  })

  it('referme la vitrine et bascule sur la boutique pour un dossier scellé', async () => {
    const wrapper = ready()
    await wrapper.findComponent(ThemeButton).get('button').trigger('click')

    await wrapper.findComponent(ThemeCarousel).vm.$emit('locked', 'football')
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('boutique')).toHaveLength(1)
    expect(document.body.textContent).not.toContain('Tout le terrain.')
  })

  it('annonce les missions restantes', () => {
    expect(ready().text()).toContain("Missions restantes aujourd'hui : 3")
  })
})

describe('SetupScreen — la table', () => {
  it('dresse un siège par agent, quatre par défaut', async () => {
    const wrapper = await atTable()
    expect(wrapper.findComponent(GameTable).findAll('.flip-scene')).toHaveLength(4)
    expect(wrapper.text()).toContain('3 loyaux · 1 infiltré')
  })

  it('ajoute et retire des sièges, dans les bornes du jeu', async () => {
    const wrapper = await atTable()
    const seats = () => wrapper.findComponent(GameTable).findAll('.flip-scene').length

    await wrapper.get(ADD_PLAYER).trigger('click')
    expect(seats()).toBe(5)

    for (let i = 0; i < 3; i++) await wrapper.get(REMOVE_PLAYER).trigger('click')
    expect(seats()).toBe(3)

    // Plancher à 3 agents.
    await wrapper.get(REMOVE_PLAYER).trigger('click')
    expect(seats()).toBe(3)
  })

  it('inscrit chaque nom sur son siège', async () => {
    const wrapper = await atTable()

    await fillNames(wrapper, ['Marion', 'Karim'])

    const table = wrapper.findComponent(GameTable)
    expect(table.text()).toContain('Marion')
    expect(table.text()).toContain('Karim')
  })

  it('bascule l’édition sur le siège touché', async () => {
    const wrapper = await atTable()

    await wrapper.findComponent(GameTable).findAll('button')[2]!.trigger('click')
    await wrapper.get('input[type="text"]').setValue('Sami')

    // Le troisième siège, pas le premier.
    expect(wrapper.findComponent(GameTable).findAll('.flip-card')[2]!.text()).toContain('Sami')
    expect(wrapper.findComponent(GameTable).findAll('.flip-card')[0]!.text()).not.toContain('Sami')
  })

  it('vise le nouveau siège dès qu’on en ajoute un', async () => {
    const wrapper = await atTable()

    await wrapper.get(ADD_PLAYER).trigger('click')
    await wrapper.get('input[type="text"]').setValue('Léa')

    expect(wrapper.findComponent(GameTable).findAll('.flip-card')[4]!.text()).toContain('Léa')
  })

  it('plafonne les undercovers pour garder les loyaux majoritaires', async () => {
    const wrapper = await atTable()

    // 4 agents : un seul undercover autorisé.
    await wrapper.get(ADD_UNDERCOVER).trigger('click')
    expect(wrapper.text()).toContain('3 loyaux · 1 infiltré')

    // 6 agents : le second undercover devient légal.
    await wrapper.get(ADD_PLAYER).trigger('click')
    await wrapper.get(ADD_PLAYER).trigger('click')
    await wrapper.get(ADD_UNDERCOVER).trigger('click')
    expect(wrapper.text()).toContain('4 loyaux · 2 infiltrés')
  })

  it('ramène le compte d’undercovers sous le plafond quand l’effectif baisse', async () => {
    const wrapper = await atTable()
    await wrapper.get(ADD_PLAYER).trigger('click')
    await wrapper.get(ADD_UNDERCOVER).trigger('click')
    expect(wrapper.text()).toContain('3 loyaux · 2 infiltrés')

    await wrapper.get(REMOVE_PLAYER).trigger('click')
    await wrapper.get(REMOVE_PLAYER).trigger('click')
    expect(wrapper.text()).toContain('2 loyaux · 1 infiltré')
  })

  it('ne descend jamais sous un undercover', async () => {
    const wrapper = await atTable()
    await wrapper.get(REMOVE_UNDERCOVER).trigger('click')
    expect(wrapper.text()).toContain('3 loyaux · 1 infiltré')
  })

  it('revient au choix du mode', async () => {
    const wrapper = await atTable()

    await wrapper.get('[aria-label="Revenir au choix du mode"]').trigger('click')

    expect(wrapper.findComponent(ModeSelector).exists()).toBe(true)
    expect(wrapper.findComponent(GameTable).exists()).toBe(false)
  })

  it('rappelle le mode et le dossier retenus', async () => {
    const wrapper = ready()
    await wrapper.findComponent(ModeSelector).vm.$emit('update:modelValue', 'chrono')
    await wrapper.findComponent(ThemeCarousel).vm.$emit('update:modelValue', 'culture')
    await buttonNamed(wrapper, 'Dresser la table').trigger('click')

    expect(wrapper.text()).toContain('Chrono')
    expect(wrapper.text()).toContain('Culture')
  })
})

describe('SetupScreen — lancement', () => {
  it('émet start avec la config, le mode et le thème', async () => {
    const wrapper = await atTable()
    const names = ['Marion', 'Karim', 'Sami', 'Léa']
    await fillNames(wrapper, names)

    await launchButton(wrapper).trigger('click')

    expect(wrapper.emitted('start')).toEqual([
      [
        {
          config: { names, undercoverCount: 1, mode: 'classique', timerSeconds: 30 },
          theme: 'general',
          custom: null
        }
      ]
    ])
  })

  it('transmet le mode et le dossier choisis au menu', async () => {
    const wrapper = ready()
    await wrapper.findComponent(ModeSelector).vm.$emit('update:modelValue', 'chrono')
    await wrapper.findComponent(ThemeCarousel).vm.$emit('update:modelValue', 'culture')
    await buttonNamed(wrapper, 'Dresser la table').trigger('click')
    await fillNames(wrapper, ['Marion', 'Karim', 'Sami', 'Léa'])

    await launchButton(wrapper).trigger('click')

    const [[submission]] = wrapper.emitted('start') as [{ config: { mode: string }, theme: string }][]
    expect(submission.config.mode).toBe('chrono')
    expect(submission.theme).toBe('culture')
  })

  /** Le pool hot est déjà un registre à part : il n'a pas de dossier à croiser. */
  it('retombe sur le dossier généraliste en mode hot', async () => {
    const wrapper = ready()
    await wrapper.findComponent(ThemeCarousel).vm.$emit('update:modelValue', 'culture')
    await wrapper.findComponent(ModeSelector).vm.$emit('update:modelValue', 'hot')
    await buttonNamed(wrapper, 'Dresser la table').trigger('click')
    await fillNames(wrapper, ['Marion', 'Karim', 'Sami', 'Léa'])

    await launchButton(wrapper).trigger('click')

    const [[submission]] = wrapper.emitted('start') as [{ theme: string }][]
    expect(submission.theme).toBe('general')
  })

  it('ne règle le temps de parole qu’en mode chrono', async () => {
    const wrapper = await atTable()
    expect(wrapper.find(ADD_TIME).exists()).toBe(false)

    await wrapper.get('[aria-label="Revenir au choix du mode"]').trigger('click')
    await wrapper.findComponent(ModeSelector).vm.$emit('update:modelValue', 'chrono')
    await buttonNamed(wrapper, 'Dresser la table').trigger('click')

    expect(wrapper.text()).toContain('30s')
    await wrapper.get(ADD_TIME).trigger('click')
    expect(wrapper.text()).toContain('35s')
  })

  it('affiche l’erreur de validation renvoyée par le jeu', async () => {
    const message = 'Deux agents ne peuvent pas partager le même nom de code.'
    expect((await atTable()).findComponent(Toast).exists()).toBe(false)
    expect((await atTable({ error: message })).findComponent(Toast).text()).toBe(message)
  })

  it('détaille la réserve achetée quand il y en a une', async () => {
    const wrapper = await atTable({ credits: { ...CREDITS, wallet: 12, remaining: 15 } })
    expect(wrapper.text()).toContain('3 du jour + 12 en réserve')
  })

  it('bloque le lancement tant que les droits ne sont pas connus', async () => {
    const wrapper = await atTable({ status: 'loading' as const, credits: null })
    expect(launchButton(wrapper).attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('vérification de ton dossier')
  })

  it('bloque le lancement pendant le tirage', async () => {
    const wrapper = await atTable({ drawing: true })
    expect(launchButton(wrapper).attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Contact du QG…')
  })

  it('bloque à quota épuisé et renvoie vers les packs', async () => {
    const wrapper = await atTable({ credits: { ...CREDITS, dailyRemaining: 0, remaining: 0 } })

    expect(launchButton(wrapper).attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('épuisé tes missions du jour')

    await buttonNamed(wrapper, 'Voir les packs').trigger('click')
    expect(wrapper.emitted('boutique')).toHaveLength(1)
  })

  it('propose de réessayer quand le QG est injoignable', async () => {
    const wrapper = await atTable({ status: 'error' as const })

    expect(launchButton(wrapper).attributes('disabled')).toBeDefined()
    await buttonNamed(wrapper, 'Réessayer').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('renvoie vers la boutique quand le tirage bute sur un verrou', async () => {
    const wrapper = await atTable({
      wordsError: 'Le mode Hot demande un pack.',
      wordsErrorKind: 'locked' as const
    })

    expect(wrapper.text()).toContain('Le mode Hot demande un pack.')
    await buttonNamed(wrapper, 'Voir les packs').trigger('click')
    expect(wrapper.emitted('boutique')).toHaveLength(1)
  })
})

describe('SetupScreen — DIY', () => {
  it('ne propose la saisie manuelle qu’avec le pack', async () => {
    expect((await atTable()).text()).not.toContain('DIY')
    expect((await atTable({ diyUnlocked: true })).text()).toContain('DIY')
  })

  /** Ouvre la saisie manuelle et rend le wrapper. */
  async function withCustomWords(props: Record<string, unknown> = {}) {
    const wrapper = await atTable({ diyUnlocked: true, ...props })
    await buttonNamed(wrapper, 'DIY').trigger('click')
    return wrapper
  }

  it('exige deux mots différents avant de lancer', async () => {
    const wrapper = await withCustomWords()
    expect(launchButton(wrapper).attributes('disabled')).toBeDefined()

    const custom = wrapper.findAll('input[type="text"]').slice(-2)
    await custom[0]!.setValue('Café')
    await custom[1]!.setValue('café')
    expect(launchButton(wrapper).attributes('disabled')).toBeDefined()

    await custom[1]!.setValue('Thé')
    expect(launchButton(wrapper).attributes('disabled')).toBeUndefined()
  })

  it('émet les mots saisis et annonce qu’aucune mission n’est consommée', async () => {
    const wrapper = await withCustomWords()
    const custom = wrapper.findAll('input[type="text"]').slice(-2)
    await custom[0]!.setValue(' Café ')
    await custom[1]!.setValue('Thé')

    expect(wrapper.text()).toContain('aucune mission consommée')
    await launchButton(wrapper).trigger('click')

    const [[submission]] = wrapper.emitted('start') as [{ custom: unknown }][]
    expect(submission.custom).toEqual({ a: 'Café', b: 'Thé' })
  })

  it('reste lançable sans crédit : la saisie manuelle n’en coûte pas', async () => {
    const wrapper = await withCustomWords({
      credits: { ...CREDITS, dailyRemaining: 0, remaining: 0 }
    })
    const custom = wrapper.findAll('input[type="text"]').slice(-2)
    await custom[0]!.setValue('Café')
    await custom[1]!.setValue('Thé')

    expect(launchButton(wrapper).attributes('disabled')).toBeUndefined()
  })

  it('referme la saisie manuelle si le pack est perdu', async () => {
    const wrapper = await withCustomWords()
    expect(wrapper.text()).toContain('Mot des loyaux')

    await wrapper.setProps({ diyUnlocked: false })

    expect(wrapper.text()).not.toContain('Mot des loyaux')
  })
})

describe('SetupScreen — vitrine des thèmes', () => {
  it('choisit un dossier depuis la vitrine plein écran', async () => {
    const wrapper = ready()
    await wrapper.findComponent(ThemeButton).get('button').trigger('click')

    // Deuxième dossier de la vitrine, puis validation.
    await new DOMWrapper(document.body.querySelector('[aria-label="Dossier suivant"]')!).trigger('click')
    const buttons = document.body.querySelectorAll('button')
    await new DOMWrapper(buttons[buttons.length - 1]!).trigger('click')

    expect(wrapper.findComponent(ThemeButton).text()).toContain('Culture')
    expect(document.body.textContent).not.toContain('Livres et musique.')
  })
})
