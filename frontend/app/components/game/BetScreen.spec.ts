import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import BetScreen from './BetScreen.vue'
import Button from '../core/Button.vue'
import Avatar from '../data-display/Avatar.vue'
import Card from '../data-display/Card.vue'
import PlayerRow from '../data-display/PlayerRow.vue'
import type { Player } from '../../composables/useGame'

const global = { components: { Button, Avatar, Card, PlayerRow } }

const PLAYERS: Player[] = [
  { id: 'agent-0', name: 'Marion', role: 'civil', word: 'Café', alive: true },
  { id: 'agent-1', name: 'Karim', role: 'undercover', word: 'Thé', alive: true },
  { id: 'agent-2', name: 'Sami', role: 'civil', word: 'Café', alive: true }
]

function screen() {
  return mount(BetScreen, { props: { round: 1, players: PLAYERS }, global })
}

/** Désigne un suspect puis valide, pour l'agent affiché. */
async function bet(wrapper: ReturnType<typeof screen>, suspectIndex: number) {
  await wrapper.findAllComponents(PlayerRow)[suspectIndex]!.vm.$emit('action')
  await wrapper.findAllComponents(Button).at(-1)!.trigger('click')
}

describe('BetScreen', () => {
  it('fait miser un agent à la fois', () => {
    const wrapper = screen()
    expect(wrapper.text()).toContain('Marion')
    expect(wrapper.text()).toContain('1 / 3')
  })

  it('ne propose jamais de miser sur soi-même', () => {
    const wrapper = screen()
    const suspects = wrapper.findAllComponents(PlayerRow).map(row => row.props('name'))
    expect(suspects).toEqual(['Karim', 'Sami'])
  })

  it('exige un suspect avant de valider', async () => {
    const wrapper = screen()
    expect(wrapper.findAllComponents(Button).at(-1)!.attributes('disabled')).toBeDefined()

    await wrapper.findAllComponents(PlayerRow)[0]!.vm.$emit('action')

    expect(wrapper.findAllComponents(Button).at(-1)!.attributes('disabled')).toBeUndefined()
  })

  it('passe à l’agent suivant après validation', async () => {
    const wrapper = screen()

    await bet(wrapper, 0)

    expect(wrapper.text()).toContain('Karim')
    expect(wrapper.text()).toContain('2 / 3')
    expect(wrapper.emitted('place')).toBeUndefined()
  })

  it('émet tous les paris une fois la table servie', async () => {
    const wrapper = screen()

    await bet(wrapper, 0) // Marion mise sur Karim
    await bet(wrapper, 1) // Karim mise sur Sami
    await bet(wrapper, 0) // Sami mise sur Marion

    expect(wrapper.emitted('place')).toEqual([
      [
        [
          { playerId: 'agent-0', targetId: 'agent-1', stake: 5 },
          { playerId: 'agent-1', targetId: 'agent-2', stake: 5 },
          { playerId: 'agent-2', targetId: 'agent-0', stake: 5 }
        ]
      ]
    ])
  })

  it('reporte la mise saisie sur les agents suivants', async () => {
    const wrapper = screen()
    await wrapper.get('input[type="number"]').setValue(12)

    await bet(wrapper, 0)
    await bet(wrapper, 1)
    await bet(wrapper, 0)

    const [[bets]] = wrapper.emitted('place') as [{ stake: number }[]][]
    expect(bets.every(entry => entry.stake === 12)).toBe(true)
  })

  it('annonce le pot déjà sur la table', async () => {
    const wrapper = screen()
    expect(wrapper.text()).toContain('déjà sur la table : 0')

    await bet(wrapper, 0)

    expect(wrapper.text()).toContain('déjà sur la table : 5')
  })

  it('rappelle que l’app ne gère aucun paiement', () => {
    expect(screen().text()).toContain('ne gère aucun paiement')
  })

  it('oublie le suspect choisi en passant à l’agent suivant', async () => {
    const wrapper = screen()

    await bet(wrapper, 0)

    expect(wrapper.findAllComponents(Button).at(-1)!.attributes('disabled')).toBeDefined()
  })
})
