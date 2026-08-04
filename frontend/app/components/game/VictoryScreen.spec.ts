import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import VictoryScreen from './VictoryScreen.vue'
import Button from '../core/Button.vue'
import RoleTag from '../core/RoleTag.vue'
import Avatar from '../data-display/Avatar.vue'
import Card from '../data-display/Card.vue'
import PlayerRow from '../data-display/PlayerRow.vue'
import type { Player, Winner } from '../../composables/useGame'

const global = { components: { Button, RoleTag, Avatar, Card, PlayerRow } }

const players: Player[] = [
  { id: 'agent-0', name: 'Marion', role: 'civil', word: 'Passeport', alive: true },
  { id: 'agent-1', name: 'Karim', role: 'undercover', word: 'Visa', alive: false },
  { id: 'agent-2', name: 'Sami', role: 'civil', word: 'Passeport', alive: true }
]

function mountScreen(winner: Exclude<Winner, null>, roster: Player[] = players) {
  return mount(VictoryScreen, { props: { winner, players: roster }, global })
}

describe('VictoryScreen', () => {
  it('célèbre les civils quand le réseau est assaini', () => {
    const wrapper = mountScreen('civils')
    expect(wrapper.text()).toContain('Réseau assaini')
    expect(wrapper.text()).toContain('Mission accomplie')
  })

  it('annonce la défaite quand les infiltrés prennent le dessus', () => {
    const wrapper = mountScreen('undercovers')
    expect(wrapper.text()).toContain('Réseau infiltré')
    expect(wrapper.text()).toContain('Mission compromise')
  })

  it('nomme les agents doubles, au singulier comme au pluriel', () => {
    expect(mountScreen('civils').text()).toContain('Agent double : Karim')

    const twoMoles = [...players, { ...players[1]!, id: 'agent-3', name: 'Léa' }]
    expect(mountScreen('civils', twoMoles).text()).toContain('Agents doubles : Karim, Léa')
  })

  it('déclassifie le rôle et le mot de chaque agent', () => {
    const wrapper = mountScreen('civils')
    const rows = wrapper.findAllComponents(PlayerRow)
    expect(rows.map(row => row.props('name'))).toEqual(['Marion', 'Karim', 'Sami'])
    expect(rows[1]!.props('status')).toBe('eliminated')
    expect(rows[0]!.props('status')).toBe('active')

    expect(wrapper.text()).toContain('Visa')
    expect(wrapper.text()).toContain('Passeport')
  })

  it('propose de rejouer ou de repartir de zéro', async () => {
    const wrapper = mountScreen('civils')
    const buttons = wrapper.findAllComponents(Button)

    await buttons[0]!.trigger('click')
    expect(wrapper.emitted('replay')).toHaveLength(1)

    await buttons[1]!.trigger('click')
    expect(wrapper.emitted('newGame')).toHaveLength(1)
  })

  it('désactive le replay quand le quota de mots du jour est épuisé', () => {
    const wrapper = mount(VictoryScreen, {
      props: { winner: 'civils' as const, players, canReplay: false },
      global
    })
    const replayButton = wrapper.findAllComponents(Button)[0]!
    expect(replayButton.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('reviens demain')
  })
})

describe('VictoryScreen — règlement des paris', () => {
  const settlement = [
    { playerId: 'agent-0', targetId: 'agent-2', stake: 5, won: true, net: 5 },
    { playerId: 'agent-1', targetId: 'agent-2', stake: 5, won: true, net: 5 },
    { playerId: 'agent-2', targetId: 'agent-0', stake: 10, won: false, net: -10 }
  ]

  function withSettlement(rows = settlement) {
    return mount(VictoryScreen, {
      props: { winner: 'civils' as const, players, settlement: rows },
      global
    })
  }

  it('ne montre rien hors du mode pari', () => {
    const wrapper = mount(VictoryScreen, {
      props: { winner: 'civils' as const, players },
      global
    })
    expect(wrapper.text()).not.toContain('Règlement des paris')
  })

  it('affiche qui doit quoi, signe compris', () => {
    const text = withSettlement().text()

    expect(text).toContain('Règlement des paris')
    expect(text).toContain('+5')
    expect(text).toContain('-10')
  })

  it('rappelle sur qui chacun avait misé', () => {
    expect(withSettlement().text()).toContain('misait 10 sur')
  })

  it('classe du plus gros gain à la plus grosse perte', () => {
    const rows = withSettlement().findAll('.font-mono.text-body')
    expect(rows[0]!.text()).toBe('+5')
    expect(rows.at(-1)!.text()).toBe('-10')
  })

  it('signale une partie nulle quand rien ne bouge', () => {
    const wrapper = withSettlement([
      { playerId: 'agent-0', targetId: 'agent-1', stake: 5, won: false, net: 0 },
      { playerId: 'agent-1', targetId: 'agent-0', stake: 5, won: false, net: 0 }
    ])

    expect(wrapper.text()).toContain('chacun reprend sa mise')
  })

  it('rappelle que l’app ne tient pas la caisse', () => {
    expect(withSettlement().text()).toContain('pas la caisse')
  })
})
