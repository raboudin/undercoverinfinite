import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RevealScreen from './RevealScreen.vue'
import GameTable from './GameTable.vue'
import Button from '../core/Button.vue'
import Card from '../data-display/Card.vue'
import type { Player } from '../../composables/useGame'

const global = { components: { Button, Card, GameTable } }

const PLAYERS: Player[] = [
  { id: 'agent-0', name: 'Marion', role: 'civil', word: 'Passeport', alive: true },
  { id: 'agent-1', name: 'Karim', role: 'undercover', word: 'Visa', alive: true },
  { id: 'agent-2', name: 'Sami', role: 'civil', word: 'Passeport', alive: true },
  { id: 'agent-3', name: 'Léa', role: 'civil', word: 'Passeport', alive: true }
]

function mountScreen(props: Record<string, unknown> = {}) {
  return mount(RevealScreen, {
    props: { players: PLAYERS, index: 0, isLast: false, ...props },
    global
  })
}

/** Bouton principal de l'écran : ouvrir sa carte, puis passer le téléphone. */
function mainButton(wrapper: ReturnType<typeof mountScreen>) {
  return wrapper.findAllComponents(Button).at(-1)!
}

describe('RevealScreen', () => {
  it('dresse la table entière, une carte par agent', () => {
    const wrapper = mountScreen()
    expect(wrapper.findComponent(GameTable).findAll('.flip-card')).toHaveLength(4)
    expect(wrapper.text()).toContain('Léa')
  })

  it('garde le mot caché tant que la carte n’est pas retournée', () => {
    const wrapper = mountScreen()
    expect(wrapper.text()).toContain('Marion')
    expect(wrapper.text()).not.toContain('Passeport')
    expect(wrapper.findAll('.flip-card--up')).toHaveLength(0)
  })

  it('affiche la position dans la distribution', () => {
    expect(mountScreen({ index: 2 }).text()).toContain('3 / 4')
  })

  it('ne rend cliquable que la carte de l’agent en poste', () => {
    const enabled = mountScreen({ index: 1 })
      .findComponent(GameTable)
      .findAll('button')
      .map(button => button.attributes('disabled') === undefined)
    expect(enabled).toEqual([false, true, false, false])
  })

  it('retourne la carte au geste sur la table', async () => {
    const wrapper = mountScreen()

    await wrapper.findComponent(GameTable).findAll('button')[0]!.trigger('click')

    expect(wrapper.findAll('.flip-card--up')).toHaveLength(1)
    expect(wrapper.text()).toContain('Passeport')
  })

  it('retourne aussi la carte depuis le bouton', async () => {
    const wrapper = mountScreen()
    await mainButton(wrapper).trigger('click')
    expect(wrapper.text()).toContain('Passeport')
  })

  it('referme la carte avant de passer le téléphone', async () => {
    const wrapper = mountScreen()
    await mainButton(wrapper).trigger('click')
    await mainButton(wrapper).trigger('click')

    expect(wrapper.emitted('next')).toHaveLength(1)
    expect(wrapper.text()).not.toContain('Passeport')
  })

  it('referme aussi la carte quand l’agent suivant prend le téléphone', async () => {
    const wrapper = mountScreen()
    await mainButton(wrapper).trigger('click')
    expect(wrapper.text()).toContain('Passeport')

    await wrapper.setProps({ index: 1 })

    expect(wrapper.text()).not.toContain('Visa')
    expect(wrapper.findAll('.flip-card--up')).toHaveLength(0)
  })

  it('change le libellé du bouton pour le dernier agent', async () => {
    const wrapper = mountScreen({ index: 3, isLast: true })
    await mainButton(wrapper).trigger('click')
    expect(mainButton(wrapper).text()).toContain('Tout le monde est briefé')
  })

  it('ne dévoile jamais le rôle, seulement le mot', async () => {
    const wrapper = mountScreen({ index: 1 })
    await mainButton(wrapper).trigger('click')

    expect(wrapper.text()).toContain('Visa')
    expect(wrapper.text().toLowerCase()).not.toContain('undercover')
    expect(wrapper.text().toLowerCase()).not.toContain('infiltré')
  })
})
