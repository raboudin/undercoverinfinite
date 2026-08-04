import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import DescribeScreen from './DescribeScreen.vue'
import GameTable from './GameTable.vue'
import Button from '../core/Button.vue'
import Card from '../data-display/Card.vue'
import ProgressTimer from '../feedback/ProgressTimer.vue'
import type { Player } from '../../composables/useGame'

const global = { components: { Button, Card, ProgressTimer, GameTable } }

const order: Player[] = ['Marion', 'Karim', 'Sami', 'Léa'].map((name, i) => ({
  id: `agent-${i}`,
  name,
  role: 'civil',
  word: 'Passeport',
  alive: true
}))

function mountScreen(speakerIndex = 0, round = 1) {
  return mount(DescribeScreen, {
    props: { round, speaker: order[speakerIndex]!, players: order, order, speakerIndex },
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

  it('dresse la table entière, sans rien retourner', () => {
    const wrapper = mountScreen()
    expect(wrapper.findComponent(GameTable).findAll('.flip-card')).toHaveLength(4)
    expect(wrapper.findAll('.flip-card--up')).toHaveLength(0)
    expect(wrapper.text()).not.toContain('Passeport')
  })

  it('allume le siège de l’orateur courant', () => {
    const glow = mountScreen(2)
      .findComponent(GameTable)
      .findAll('.flip-card')
      .map(card => card.classes().includes('shadow-glow-recon'))
    expect(glow).toEqual([false, false, true, false])
  })

  it('annonce l’agent suivant dans l’ordre de parole', () => {
    expect(mountScreen(0).text()).toContain('Ensuite : Karim')
    expect(mountScreen(3).text()).not.toContain('Ensuite')
  })

  it('laisse retournées les cartes des agents grillés', () => {
    const players = order.map((player, i) =>
      i === 3 ? { ...player, alive: false, word: 'Douane' } : player
    )
    const wrapper = mount(DescribeScreen, {
      props: { round: 2, speaker: order[0]!, players, order: players.slice(0, 3), speakerIndex: 0 },
      global
    })

    expect(wrapper.findAll('.flip-card--up')).toHaveLength(1)
    expect(wrapper.text()).toContain('Douane')
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

describe('DescribeScreen — mode défi', () => {
  it('n’affiche aucun défi par défaut', () => {
    expect(mountScreen(0).text()).not.toContain('Défi de la mission')
  })

  it('affiche le défi de la partie', () => {
    const wrapper = mount(DescribeScreen, {
      props: {
        round: 1,
        speaker: order[0]!,
        players: order,
        order,
        speakerIndex: 0,
        challenge: 'Chaque description doit contenir une couleur'
      },
      global
    })

    expect(wrapper.text()).toContain('Défi de la mission')
    expect(wrapper.text()).toContain('Chaque description doit contenir une couleur')
  })
})

describe('DescribeScreen — mode chrono', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function timed(props: Record<string, unknown> = {}) {
    return mount(DescribeScreen, {
      props: {
        round: 1,
        speaker: order[0]!,
        players: order,
        order,
        speakerIndex: 0,
        timed: true,
        timerSeconds: 10,
        ...props
      },
      global
    })
  }

  it('affiche le temps restant à la place de l’avancement', () => {
    expect(timed().text()).toContain('10s')
  })

  it('décompte seconde par seconde', async () => {
    const wrapper = timed()

    vi.advanceTimersByTime(3000)
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('7s')
    expect(wrapper.findComponent(ProgressTimer).props('pct')).toBeCloseTo(0.7)
  })

  it('passe en alerte dans le dernier quart', async () => {
    const wrapper = timed()
    expect(wrapper.findComponent(ProgressTimer).props('danger')).toBe(false)

    vi.advanceTimersByTime(8000)
    await wrapper.vm.$nextTick()

    expect(wrapper.findComponent(ProgressTimer).props('danger')).toBe(true)
  })

  it('passe la main toute seule à l’expiration', async () => {
    const wrapper = timed()

    vi.advanceTimersByTime(10000)
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('next')).toHaveLength(1)
  })

  it('n’émet next qu’une fois : le minuteur s’arrête à zéro', async () => {
    const wrapper = timed()

    vi.advanceTimersByTime(30000)
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('next')).toHaveLength(1)
  })

  it('repart à plein temps à l’agent suivant', async () => {
    const wrapper = timed()
    vi.advanceTimersByTime(4000)
    await wrapper.vm.$nextTick()
    expect(wrapper.text()).toContain('6s')

    await wrapper.setProps({ speakerIndex: 1, speaker: order[1]! })

    expect(wrapper.text()).toContain('10s')
  })

  it('ne minute rien hors du mode chrono', async () => {
    const wrapper = mountScreen(0)

    vi.advanceTimersByTime(60000)
    await wrapper.vm.$nextTick()

    expect(wrapper.emitted('next')).toBeUndefined()
  })
})
