import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DescribeScreen from './DescribeScreen.vue'
import Button from '../core/Button.vue'
import Avatar from '../data-display/Avatar.vue'
import Card from '../data-display/Card.vue'
import PlayerRow from '../data-display/PlayerRow.vue'
import ProgressTimer from '../feedback/ProgressTimer.vue'
import type { Player } from '../../composables/useGame'

const global = { components: { Button, Avatar, Card, PlayerRow, ProgressTimer } }

const order: Player[] = ['Marion', 'Karim', 'Sami', 'Léa'].map((name, i) => ({
  id: `agent-${i}`,
  name,
  role: 'civil',
  word: 'Passeport',
  alive: true
}))

function mountScreen(speakerIndex = 0, round = 1) {
  return mount(DescribeScreen, {
    props: { round, speaker: order[speakerIndex]!, order, speakerIndex },
    global
  })
}

describe('DescribeScreen', () => {
  it('annonce la manche et l’agent qui a la parole', () => {
    const wrapper = mountScreen(1, 2)
    expect(wrapper.text()).toContain('Manche 2 — transmission')
    expect(wrapper.text()).toContain('Karim')
    expect(wrapper.text()).toContain('2 / 4')
  })

  it('liste tout l’ordre de parole', () => {
    const rows = mountScreen().findAllComponents(PlayerRow)
    expect(rows.map(row => row.props('name'))).toEqual(['Marion', 'Karim', 'Sami', 'Léa'])
  })

  it('met en avant l’orateur courant dans la liste', () => {
    // Le halo est porté par le conteneur de la ligne ; la Card d'en-tête utilise
    // la même classe, d'où la recherche ciblée sur les lignes de joueurs.
    const rows = mountScreen(2).findAllComponents(PlayerRow)
    const glow = rows.map(row => row.element.parentElement!.className.includes('shadow-glow-recon'))
    expect(glow).toEqual([false, false, true, false])
  })

  it('fait progresser la barre au fil des prises de parole', () => {
    expect(mountScreen(0).findComponent(ProgressTimer).props('pct')).toBeCloseTo(0.25)
    expect(mountScreen(3).findComponent(ProgressTimer).props('pct')).toBeCloseTo(1)
  })

  it('bascule le libellé du bouton sur le vote au dernier orateur', async () => {
    expect(mountScreen(0).findComponent(Button).text()).toContain('Agent suivant')

    const last = mountScreen(3)
    expect(last.findComponent(Button).text()).toContain('Ouvrir le vote')

    await last.findComponent(Button).trigger('click')
    expect(last.emitted('next')).toHaveLength(1)
  })
})
