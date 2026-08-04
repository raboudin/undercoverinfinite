import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import EliminationScreen from './EliminationScreen.vue'
import GameTable from './GameTable.vue'
import Button from '../core/Button.vue'
import RoleTag from '../core/RoleTag.vue'
import Card from '../data-display/Card.vue'
import type { Player } from '../../composables/useGame'

const global = { components: { Button, Card, RoleTag, GameTable } }

const PLAYERS: Player[] = ['Marion', 'Karim', 'Sami', 'Léa'].map((name, i) => ({
  id: `agent-${i}`,
  name,
  role: 'civil',
  word: 'Passeport',
  alive: true
}))

/** Karim vient d'être désigné : sa carte est la seule à retourner. */
function mountScreen(overrides: Partial<Player> = {}) {
  const eliminated: Player = { ...PLAYERS[1]!, alive: false, ...overrides }
  const players = PLAYERS.map(player => (player.id === eliminated.id ? eliminated : player))
  return mount(EliminationScreen, { props: { player: eliminated, players }, global })
}

function mainButton(wrapper: ReturnType<typeof mountScreen>) {
  return wrapper.findAllComponents(Button).at(-1)!
}

describe('EliminationScreen', () => {
  it('présente la carte du désigné face cachée', () => {
    const wrapper = mountScreen()

    expect(wrapper.text()).toContain('Karim')
    expect(wrapper.text()).toContain('carte face cachée')
    expect(wrapper.text()).not.toContain('Passeport')
    expect(wrapper.findAll('.flip-card--up')).toHaveLength(0)
  })

  it('ne rend cliquable que la carte du désigné', () => {
    const enabled = mountScreen()
      .findComponent(GameTable)
      .findAll('button')
      .map(button => button.attributes('disabled') === undefined)
    expect(enabled).toEqual([false, true, false, false])
  })

  it('retourne la carte au geste sur la table et découvre le mot', async () => {
    const wrapper = mountScreen()

    await wrapper.findComponent(GameTable).findAll('button')[1]!.trigger('click')

    expect(wrapper.findAll('.flip-card--up')).toHaveLength(1)
    expect(wrapper.text()).toContain('Passeport')
    expect(wrapper.text()).toContain('carte retournée')
  })

  it('anime le retournement du seul siège concerné', async () => {
    const wrapper = mountScreen()
    expect(wrapper.findAll('.seat-reveal')).toHaveLength(0)

    await mainButton(wrapper).trigger('click')

    expect(wrapper.findAll('.seat-reveal')).toHaveLength(1)
  })

  it('retourne aussi la carte depuis le bouton', async () => {
    const wrapper = mountScreen()
    await mainButton(wrapper).trigger('click')
    expect(wrapper.text()).toContain('Passeport')
  })

  it('annonce le camp de l’agent grillé une fois la carte retournée', async () => {
    const asUndercover = mountScreen({ role: 'undercover', word: 'Visa' })
    await mainButton(asUndercover).trigger('click')
    expect(asUndercover.text()).toContain('Agent double')
    expect(asUndercover.text()).toContain('Un infiltré de moins')

    const asCivil = mountScreen({ role: 'civil', word: 'Visa' })
    await mainButton(asCivil).trigger('click')
    expect(asCivil.text()).toContain('Agent loyal')
    expect(asCivil.text()).toContain('Erreur de jugement')
  })

  /**
   * Le camp se dit dans le débriefing, jamais sur la carte : les deux plateaux
   * doivent être indiscernables, sans quoi un coup d'œil à la table suffirait
   * à répondre avant le retournement.
   */
  it('ne met jamais le camp sur la carte', async () => {
    const table = async (role: 'undercover' | 'civil') => {
      const wrapper = mountScreen({ role, word: 'Visa' })
      await mainButton(wrapper).trigger('click')
      return wrapper.findComponent(GameTable).text()
    }

    expect(await table('undercover')).toBe(await table('civil'))
  })

  it('enchaîne la manche suivante', async () => {
    const wrapper = mountScreen()
    await mainButton(wrapper).trigger('click')

    await mainButton(wrapper).trigger('click')

    expect(wrapper.emitted('next')).toHaveLength(1)
  })

  it('laisse retournées les cartes des manches précédentes', () => {
    const players = PLAYERS.map((player, i) =>
      i === 0 ? { ...player, alive: false, word: 'Douane' } : i === 1 ? { ...player, alive: false } : player
    )
    const wrapper = mount(EliminationScreen, {
      props: { player: players[1]!, players },
      global
    })

    expect(wrapper.findAll('.flip-card--up')).toHaveLength(1)
    expect(wrapper.text()).toContain('Douane')
  })
})
