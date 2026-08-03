import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SetupScreen from './SetupScreen.vue'
import ModeSelector from './ModeSelector.vue'
import ThemeSelector from './ThemeSelector.vue'
import Button from '../core/Button.vue'
import IconButton from '../core/IconButton.vue'
import Card from '../data-display/Card.vue'
import Toast from '../feedback/Toast.vue'
import type { Credits } from '../../composables/useEntitlements'

// Les composants du design system sont auto-importés par Nuxt ; en test
// unitaire il faut les enregistrer explicitement.
const global = {
  components: { Button, IconButton, Card, Toast, ModeSelector, ThemeSelector }
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

const MODES = [
  { id: 'classique' as const, label: 'Classique', tagline: 'La mission d’origine.', available: true, unlocked: true, playable: true },
  { id: 'chrono' as const, label: 'Chrono', tagline: 'Parole minutée.', available: true, unlocked: true, playable: true },
  { id: 'hot' as const, label: 'Hot', tagline: 'Mots osés.', available: true, spicy: true, unlocked: true, playable: true },
  { id: 'teams' as const, label: 'Teams', tagline: 'Deux équipes.', available: false, unlocked: true, playable: false },
  { id: 'pari' as const, label: 'Pari risqué', tagline: 'Chacun mise.', available: true, unlocked: false, playable: false }
]

const THEMES = [
  { id: 'general' as const, label: 'Tous horizons', generalist: true, unlocked: true },
  { id: 'football' as const, label: 'Football', generalist: false, unlocked: false }
]

/** Écran prêt à jouer : droits chargés, crédits disponibles. */
function ready(props: Record<string, unknown> = {}) {
  return mount(SetupScreen, {
    props: { modes: MODES, themes: THEMES, credits: CREDITS, ...props },
    global
  })
}

/** Le bouton de lancement est toujours le dernier de l'écran. */
function launchButton(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAllComponents(Button).at(-1)!
}

async function fillNames(wrapper: ReturnType<typeof mount>, names: string[]) {
  const inputs = wrapper.findAll('input[type="text"]')
  for (const [index, input] of inputs.entries()) await input.setValue(names[index])
}

describe('SetupScreen — effectif', () => {
  it('démarre avec quatre agents et un undercover', () => {
    const wrapper = ready()
    expect(wrapper.findAll('input[type="text"]')).toHaveLength(4)
    expect(wrapper.text()).toContain('3 loyaux · 1 infiltré')
  })

  it('ajoute et retire des champs de nom de code, dans les bornes du jeu', async () => {
    const wrapper = ready()

    await wrapper.get(ADD_PLAYER).trigger('click')
    expect(wrapper.findAll('input[type="text"]')).toHaveLength(5)

    for (let i = 0; i < 3; i++) await wrapper.get(REMOVE_PLAYER).trigger('click')
    expect(wrapper.findAll('input[type="text"]')).toHaveLength(3)

    // Plancher à 3 agents.
    await wrapper.get(REMOVE_PLAYER).trigger('click')
    expect(wrapper.findAll('input[type="text"]')).toHaveLength(3)
  })

  it('plafonne les undercovers pour garder les loyaux majoritaires', async () => {
    const wrapper = ready()

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
    const wrapper = ready()
    await wrapper.get(ADD_PLAYER).trigger('click')
    await wrapper.get(ADD_UNDERCOVER).trigger('click')
    expect(wrapper.text()).toContain('3 loyaux · 2 infiltrés')

    await wrapper.get(REMOVE_PLAYER).trigger('click')
    await wrapper.get(REMOVE_PLAYER).trigger('click')
    expect(wrapper.text()).toContain('2 loyaux · 1 infiltré')
  })

  it('ne descend jamais sous un undercover', async () => {
    const wrapper = ready()
    await wrapper.get(REMOVE_UNDERCOVER).trigger('click')
    expect(wrapper.text()).toContain('3 loyaux · 1 infiltré')
  })
})

describe('SetupScreen — lancement', () => {
  it('émet start avec la config, le mode et le thème', async () => {
    const wrapper = ready()
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

  it('affiche l’erreur de validation renvoyée par le jeu', () => {
    const message = 'Deux agents ne peuvent pas partager le même nom de code.'
    expect(ready().findComponent(Toast).exists()).toBe(false)
    expect(ready({ error: message }).findComponent(Toast).text()).toBe(message)
  })

  it('annonce les missions restantes', () => {
    expect(ready().text()).toContain("Missions restantes aujourd'hui : 3")
  })

  it('détaille la réserve achetée quand il y en a une', () => {
    const wrapper = ready({
      credits: { ...CREDITS, wallet: 12, remaining: 15 }
    })
    expect(wrapper.text()).toContain('3 du jour + 12 en réserve')
  })

  it('bloque le lancement tant que les droits ne sont pas connus', () => {
    const wrapper = ready({ status: 'loading' as const, credits: null })
    expect(launchButton(wrapper).attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('vérification de ton dossier')
  })

  it('bloque le lancement pendant le tirage', () => {
    const wrapper = ready({ drawing: true })
    expect(launchButton(wrapper).attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Contact du QG…')
  })

  it('bloque à quota épuisé et renvoie vers les packs', async () => {
    const wrapper = ready({
      credits: { ...CREDITS, dailyRemaining: 0, remaining: 0 }
    })

    expect(launchButton(wrapper).attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('épuisé tes missions du jour')

    const seePacks = wrapper
      .findAllComponents(Button)
      .find(button => button.text() === 'Voir les packs')!
    await seePacks.trigger('click')
    expect(wrapper.emitted('boutique')).toHaveLength(1)
  })

  it('propose de réessayer quand le QG est injoignable', async () => {
    const wrapper = ready({ status: 'error' as const })

    expect(launchButton(wrapper).attributes('disabled')).toBeDefined()
    const retry = wrapper
      .findAllComponents(Button)
      .find(button => button.text() === 'Réessayer')!
    await retry.trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('renvoie vers la boutique quand le tirage bute sur un verrou', async () => {
    const wrapper = ready({
      wordsError: 'Le mode Hot demande un pack.',
      wordsErrorKind: 'locked' as const
    })

    expect(wrapper.text()).toContain('Le mode Hot demande un pack.')
    const seePacks = wrapper
      .findAllComponents(Button)
      .find(button => button.text() === 'Voir les packs')!
    await seePacks.trigger('click')
    expect(wrapper.emitted('boutique')).toHaveLength(1)
  })
})

describe('SetupScreen — modes', () => {
  it('transmet le mode choisi', async () => {
    const wrapper = ready()

    await wrapper.findComponent(ModeSelector).vm.$emit('update:modelValue', 'hot')
    await fillNames(wrapper, ['Marion', 'Karim', 'Sami', 'Léa'])
    await launchButton(wrapper).trigger('click')

    const [[submission]] = wrapper.emitted('start') as [{ config: { mode: string } }][]
    expect(submission.config.mode).toBe('hot')
  })

  it('avertit que le mode hot est réservé aux adultes', async () => {
    const wrapper = ready()
    expect(wrapper.text()).not.toContain('public adulte')

    await wrapper.findComponent(ModeSelector).vm.$emit('update:modelValue', 'hot')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('public adulte')
  })

  it('ne règle le temps de parole qu’en mode chrono', async () => {
    const wrapper = ready()
    expect(wrapper.find(ADD_TIME).exists()).toBe(false)

    await wrapper.findComponent(ModeSelector).vm.$emit('update:modelValue', 'chrono')
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('30s')
    await wrapper.get(ADD_TIME).trigger('click')
    expect(wrapper.text()).toContain('35s')
  })

  it('remonte un mode verrouillé vers la boutique', async () => {
    const wrapper = ready()

    await wrapper.findComponent(ModeSelector).vm.$emit('locked', 'pari')

    expect(wrapper.emitted('boutique')).toHaveLength(1)
  })

  it('remonte un thème verrouillé vers la boutique', async () => {
    const wrapper = ready()

    await wrapper.findComponent(ThemeSelector).vm.$emit('locked', 'football')

    expect(wrapper.emitted('boutique')).toHaveLength(1)
  })
})

describe('SetupScreen — DIY', () => {
  it('ne propose la saisie manuelle qu’avec le pack', () => {
    expect(ready().text()).not.toContain('DIY')
    expect(ready({ diyUnlocked: true }).text()).toContain('DIY')
  })

  /** Ouvre la saisie manuelle et rend le wrapper. */
  async function withCustomWords(props: Record<string, unknown> = {}) {
    const wrapper = ready({ diyUnlocked: true, ...props })
    const toggle = wrapper.findAllComponents(Button).find(button => button.text() === 'DIY')!
    await toggle.trigger('click')
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
