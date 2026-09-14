import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SetupScreen from './SetupScreen.vue'
import SpicyToggle from './SpicyToggle.vue'
import DifficultySlider from './DifficultySlider.vue'
import GameTable from './GameTable.vue'
import ArtSlot from './ArtSlot.vue'
import Button from '../core/Button.vue'
import IconButton from '../core/IconButton.vue'
import Card from '../data-display/Card.vue'
import Toast from '../feedback/Toast.vue'
import type { DifficultyCard } from '../../composables/useEntitlements'

// Les composants du design system sont auto-importés par Nuxt ; en test
// unitaire il faut les enregistrer explicitement.
const global = {
  components: {
    Button, IconButton, Card, Toast,
    SpicyToggle, DifficultySlider, GameTable, ArtSlot
  }
}

const ADD_PLAYER = '[aria-label="Ajouter un agent"]'
const REMOVE_PLAYER = '[aria-label="Retirer un agent"]'
const ADD_UNDERCOVER = '[aria-label="Ajouter un undercover"]'
const REMOVE_UNDERCOVER = '[aria-label="Retirer un undercover"]'
const SPICY_SWITCH = '[role="switch"]'

const DIFFICULTIES: DifficultyCard[] = [
  { id: 'evident', level: 1, label: 'Évident', tagline: 'Une association immédiate.' },
  { id: 'normal', level: 3, label: 'Normal', tagline: 'Assez proches pour bluffer.' },
  { id: 'farfelu', level: 5, label: 'Farfelu', tagline: 'Un lien indirect.' }
]

type Wrapper = ReturnType<typeof mount>

/** Écran prêt à jouer : droits chargés. Étape menu. */
function ready(props: Record<string, unknown> = {}) {
  return mount(SetupScreen, {
    props: { difficulties: DIFFICULTIES, ...props },
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
  it('n\'affiche que le registre hot et la difficulté', () => {
    const wrapper = ready()

    expect(wrapper.find(SPICY_SWITCH).exists()).toBe(true)
    expect(wrapper.findComponent(DifficultySlider).exists()).toBe(true)
    // Ni effectif, ni noms de code : tout ça vit sur la table.
    expect(wrapper.find('input[type="text"]').exists()).toBe(false)
    expect(wrapper.find(ADD_UNDERCOVER).exists()).toBe(false)
    expect(wrapper.findComponent(GameTable).exists()).toBe(false)
  })

  it('active le registre hot et affiche l\'avertissement', async () => {
    const wrapper = ready()
    expect(wrapper.text()).not.toContain('public adulte')

    await wrapper.get(SPICY_SWITCH).trigger('click')

    expect(wrapper.text()).toContain('public adulte')
  })

  it('choisit une difficulté au clic', async () => {
    const wrapper = ready()
    expect(wrapper.text()).toContain('Normal')

    await wrapper.get('[aria-label="Farfelu"]').trigger('click')

    expect(wrapper.text()).toContain('Farfelu')
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

  it('bascule l\'édition sur le siège touché', async () => {
    const wrapper = await atTable()

    await wrapper.findComponent(GameTable).findAll('button')[2]!.trigger('click')
    await wrapper.get('input[type="text"]').setValue('Sami')

    // Le troisième siège, pas le premier.
    expect(wrapper.findComponent(GameTable).findAll('.flip-card')[2]!.text()).toContain('Sami')
    expect(wrapper.findComponent(GameTable).findAll('.flip-card')[0]!.text()).not.toContain('Sami')
  })

  it('vise le nouveau siège dès qu\'on en ajoute un', async () => {
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

  it('ramène le compte d\'undercovers sous le plafond quand l\'effectif baisse', async () => {
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

  it('revient au menu', async () => {
    const wrapper = await atTable()

    await wrapper.get('[aria-label="Revenir au menu"]').trigger('click')

    expect(wrapper.find(SPICY_SWITCH).exists()).toBe(true)
    expect(wrapper.findComponent(GameTable).exists()).toBe(false)
  })

  it('rappelle la difficulté retenue dans l\'en-tête de la table', async () => {
    const wrapper = ready()
    await wrapper.get('[aria-label="Farfelu"]').trigger('click')
    await buttonNamed(wrapper, 'Dresser la table').trigger('click')

    expect(wrapper.text()).toContain('Farfelu')
  })
})

describe('SetupScreen — lancement', () => {
  it('émet start avec la config, le hot et la difficulté', async () => {
    const wrapper = await atTable()
    const names = ['Marion', 'Karim', 'Sami', 'Léa']
    await fillNames(wrapper, names)

    await launchButton(wrapper).trigger('click')

    expect(wrapper.emitted('start')).toEqual([
      [
        {
          config: { names, undercoverCount: 1 },
          spicy: false,
          difficulty: 'normal'
        }
      ]
    ])
  })

  it('transmet le hot et la difficulté choisis au menu', async () => {
    const wrapper = ready()
    await wrapper.get(SPICY_SWITCH).trigger('click')
    await wrapper.get('[aria-label="Farfelu"]').trigger('click')
    await buttonNamed(wrapper, 'Dresser la table').trigger('click')
    await fillNames(wrapper, ['Marion', 'Karim', 'Sami', 'Léa'])

    await launchButton(wrapper).trigger('click')

    const [[submission]] = wrapper.emitted('start') as [
      { spicy: boolean, difficulty: string }
    ][]
    expect(submission.spicy).toBe(true)
    expect(submission.difficulty).toBe('farfelu')
  })

  it('affiche l\'erreur de validation renvoyée par le jeu', async () => {
    const message = 'Deux agents ne peuvent pas partager le même nom de code.'
    expect((await atTable()).findComponent(Toast).exists()).toBe(false)
    expect((await atTable({ error: message })).findComponent(Toast).text()).toBe(message)
  })

  it('bloque le lancement tant que les droits ne sont pas connus', async () => {
    const wrapper = await atTable({ status: 'loading' as const })
    expect(launchButton(wrapper).attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('vérification du dossier')
  })

  it('bloque le lancement pendant le tirage', async () => {
    const wrapper = await atTable({ drawing: true })
    expect(launchButton(wrapper).attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Contact du QG…')
  })

  it('propose de réessayer quand le QG est injoignable', async () => {
    const wrapper = await atTable({ status: 'error' as const })

    expect(launchButton(wrapper).attributes('disabled')).toBeDefined()
    await buttonNamed(wrapper, 'Réessayer').trigger('click')
    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('affiche l\'erreur de tirage', async () => {
    const wrapper = await atTable({ wordsError: 'Le QG n\'arrive pas à préparer cette mission.' })
    expect(wrapper.text()).toContain('Le QG n\'arrive pas à préparer cette mission.')
  })
})
