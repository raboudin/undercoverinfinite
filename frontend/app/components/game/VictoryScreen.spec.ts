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
})
