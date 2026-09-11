import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import OnlineVoteScreen from './OnlineVoteScreen.vue'
import GameTable from '../game/GameTable.vue'
import Toast from '../feedback/Toast.vue'
import type { OnlinePlayer, RoomVoteRow } from '../../composables/useRoomSocket'

const global = { components: { GameTable, Toast } }

function player(overrides: Partial<OnlinePlayer> = {}): OnlinePlayer {
  return {
    id: 'p1',
    displayName: 'Marion',
    isHost: false,
    seat: 0,
    alive: true,
    hasSeenReveal: true,
    connected: true,
    role: null,
    word: null,
    ...overrides
  }
}

const PLAYERS: OnlinePlayer[] = [
  player({ id: 'p1', displayName: 'Marion', seat: 0 }),
  player({ id: 'p2', displayName: 'Karim', seat: 1 }),
  player({ id: 'p3', displayName: 'Sami', seat: 2 }),
  player({ id: 'p4', displayName: 'Léa', seat: 3 })
]

function mountScreen(props: Record<string, unknown> = {}) {
  return mount(OnlineVoteScreen, {
    props: { round: 2, attempt: 1, players: PLAYERS, votes: [], viewerPlayerId: 'p1', ...props },
    global
  })
}

function seats(wrapper: ReturnType<typeof mountScreen>) {
  return wrapper.findComponent(GameTable).findAll('button')
}

describe('OnlineVoteScreen', () => {
  it('rappelle la manche et compte les votes déjà posés', () => {
    const votes: RoomVoteRow[] = [{ voterId: 'p2', targetId: 'p3' }]
    const wrapper = mountScreen({ votes })
    expect(wrapper.text()).toContain('Manche 2')
    expect(wrapper.text()).toContain('1 / 4 votes')
  })

  it('annonce la tentative au-delà de la première', () => {
    expect(mountScreen({ attempt: 2 }).text()).toContain('tentative 2')
    expect(mountScreen({ attempt: 1 }).text()).not.toContain('tentative')
  })

  it('affiche le décompte public par candidat', () => {
    const votes: RoomVoteRow[] = [
      { voterId: 'p1', targetId: 'p3' },
      { voterId: 'p2', targetId: 'p3' },
      { voterId: 'p4', targetId: 'p2' }
    ]
    const wrapper = mountScreen({ votes })
    expect(wrapper.text()).toContain('2 voix')
    expect(wrapper.text()).toContain('1 voix')
  })

  it('ne permet pas de voter pour soi-même', () => {
    const wrapper = mountScreen()
    expect(seats(wrapper)[0]!.attributes('disabled')).toBeDefined()
  })

  it('interdit de voter pour un agent déjà grillé', () => {
    const withDead = PLAYERS.map(p => (p.id === 'p3' ? { ...p, alive: false, word: 'Visa' } : p))
    const wrapper = mountScreen({ players: withDead })
    const target = seats(wrapper)[2]!
    expect(target.attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Visa')
  })

  it('émet vote avec la cible choisie', async () => {
    const wrapper = mountScreen()
    await seats(wrapper)[1]!.trigger('click')
    expect(wrapper.emitted('vote')).toEqual([['p2']])
  })

  it('verrouille tous les sièges une fois le vote posé', () => {
    const votes: RoomVoteRow[] = [{ voterId: 'p1', targetId: 'p2' }]
    const wrapper = mountScreen({ votes })
    const enabled = seats(wrapper).map(seat => seat.attributes('disabled') === undefined)
    expect(enabled).toEqual([false, false, false, false])
  })

  it('affiche un bandeau d’égalité quand des cibles sont ex-aequo', () => {
    const wrapper = mountScreen({ tiedPlayerIds: ['p2', 'p3'] })
    expect(wrapper.findComponent(Toast).exists()).toBe(true)
    expect(wrapper.text()).toContain('Égalité')
    expect(wrapper.text()).toContain('Karim')
    expect(wrapper.text()).toContain('Sami')
  })

  it('ne fuit ni rôle ni mot des agents encore en vie', () => {
    const withRoles = PLAYERS.map(p => (p.id === 'p2' ? { ...p, role: 'undercover' as const } : p))
    const wrapper = mountScreen({ players: withRoles })
    expect(wrapper.text().toLowerCase()).not.toContain('undercover')
  })
})
