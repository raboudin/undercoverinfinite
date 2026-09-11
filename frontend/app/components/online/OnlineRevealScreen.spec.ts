import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import OnlineRevealScreen from './OnlineRevealScreen.vue'
import GameTable from '../game/GameTable.vue'
import Button from '../core/Button.vue'
import Card from '../data-display/Card.vue'
import type { OnlinePlayer } from '../../composables/useRoomSocket'

const global = { components: { Button, Card, GameTable } }

function player(overrides: Partial<OnlinePlayer> = {}): OnlinePlayer {
  return {
    id: 'p1',
    displayName: 'Marion',
    isHost: false,
    seat: 0,
    alive: true,
    hasSeenReveal: false,
    connected: true,
    role: null,
    word: null,
    ...overrides
  }
}

const PLAYERS: OnlinePlayer[] = [
  player({ id: 'p1', displayName: 'Marion', role: 'civil', word: 'Passeport' }),
  player({ id: 'p2', displayName: 'Karim', seat: 1 })
]

function mountScreen(props: Record<string, unknown> = {}) {
  return mount(OnlineRevealScreen, {
    props: { players: PLAYERS, viewerPlayerId: 'p1', ...props },
    global
  })
}

describe('OnlineRevealScreen', () => {
  it('ne rend cliquable que le siège du spectateur', () => {
    const wrapper = mountScreen()
    const buttons = wrapper.findComponent(GameTable).findAll('button')
    expect(buttons).toHaveLength(2)
    const enabled = buttons.map(button => button.attributes('disabled') === undefined)
    expect(enabled).toEqual([true, false])
  })

  it('garde le mot caché tant que la carte n’est pas retournée', () => {
    const wrapper = mountScreen()
    expect(wrapper.text()).not.toContain('Passeport')
  })

  it('révèle son propre mot au clic, jamais le rôle', async () => {
    const wrapper = mountScreen()
    await wrapper.findComponent(GameTable).findAll('button')[0]!.trigger('click')

    expect(wrapper.text()).toContain('Passeport')
    expect(wrapper.text().toLowerCase()).not.toContain('civil')
  })

  it('affiche le nombre d’agents encore en attente', () => {
    expect(mountScreen().text()).toContain('0 / 2 prêts')
  })

  it('compte un agent en plus une fois qu’il a acquitté sa révélation', () => {
    const withAck = PLAYERS.map(item => (item.id === 'p2' ? { ...item, hasSeenReveal: true } : item))
    const wrapper = mountScreen({ players: withAck })
    expect(wrapper.text()).toContain('1 / 2 prêts')
  })

  it('émet ack une fois la carte mémorisée', async () => {
    const wrapper = mountScreen()
    await wrapper.findComponent(GameTable).findAll('button')[0]!.trigger('click')
    // `findComponent(Button)` attraperait aussi les <button> natifs de
    // `GameTable` (mêmes classes utilitaires) : on cible le dernier bouton du
    // DOM, qui est bien le CTA de confirmation hors du plateau.
    await wrapper.findAll('button').at(-1)!.trigger('click')

    expect(wrapper.emitted('ack')).toHaveLength(1)
  })

  it('n’émet rien tant que la carte n’a pas été retournée', () => {
    const wrapper = mountScreen()
    expect(wrapper.emitted('ack')).toBeUndefined()
  })
})
