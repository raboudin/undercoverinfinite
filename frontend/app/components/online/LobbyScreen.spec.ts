import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import LobbyScreen from './LobbyScreen.vue'
import Button from '../core/Button.vue'
import Card from '../data-display/Card.vue'
import IconButton from '../core/IconButton.vue'
import PlayerRow from '../data-display/PlayerRow.vue'
import Toast from '../feedback/Toast.vue'
import type { OnlinePlayer } from '../../composables/useRoomSocket'

const global = {
  components: { Button, Card, IconButton, PlayerRow, Toast },
  stubs: { ThemeButton: true, ThemeCarousel: true }
}

function player(overrides: Partial<OnlinePlayer> = {}): OnlinePlayer {
  return {
    id: 'p1',
    displayName: 'Marion',
    isHost: false,
    seat: null,
    alive: true,
    hasSeenReveal: false,
    connected: true,
    role: null,
    word: null,
    ...overrides
  }
}

const THREE_PLAYERS: OnlinePlayer[] = [
  player({ id: 'p1', displayName: 'Marion', isHost: true }),
  player({ id: 'p2', displayName: 'Karim' }),
  player({ id: 'p3', displayName: 'Sami' })
]

function mountScreen(props: Record<string, unknown> = {}) {
  return mount(LobbyScreen, {
    props: {
      code: 'ABC234',
      inviteUrl: 'https://undercoverinfinite.com/salle/ABC234',
      players: THREE_PLAYERS,
      viewerPlayerId: 'p1',
      isHost: true,
      theme: 'general',
      undercoverCount: 1,
      ...props
    },
    global
  })
}

describe('LobbyScreen', () => {
  it('affiche le code de la salle et les agents présents', () => {
    const wrapper = mountScreen()
    expect(wrapper.text()).toContain('ABC234')
    expect(wrapper.text()).toContain('Karim')
    expect(wrapper.text()).toContain('Sami')
  })

  it('marque le spectateur parmi la liste', () => {
    expect(mountScreen().text()).toContain('Marion (toi)')
  })

  it('ne montre pas les réglages hôte à un invité', () => {
    const wrapper = mountScreen({ isHost: false })
    expect(wrapper.text()).toContain('En attente que l\'hôte')
    expect(wrapper.findAllComponents(Button).some(b => b.text().includes('Lancer'))).toBe(false)
  })

  it('désactive le lancement sous l’effectif minimum', () => {
    const wrapper = mountScreen({ players: THREE_PLAYERS.slice(0, 2) })
    const start = wrapper.findAllComponents(Button).find(b => b.text().includes('Lancer'))!
    expect(start.attributes('disabled')).toBeDefined()
  })

  it('autorise le lancement à effectif et réglage valides', () => {
    const wrapper = mountScreen()
    const start = wrapper.findAllComponents(Button).find(b => b.text().includes('Lancer'))!
    expect(start.attributes('disabled')).toBeUndefined()
  })

  it('émet start au clic', async () => {
    const wrapper = mountScreen()
    const start = wrapper.findAllComponents(Button).find(b => b.text().includes('Lancer'))!
    await start.trigger('click')
    expect(wrapper.emitted('start')).toHaveLength(1)
  })

  it('plafonne le nombre d’undercovers à la majorité civile stricte', async () => {
    // 3 agents -> maxUndercovers(3) = 1 : le bouton "+" ne doit rien émettre.
    const wrapper = mountScreen()
    const [, plus] = wrapper.findAllComponents(IconButton)
    await plus!.trigger('click')
    expect(wrapper.emitted('configure')).toBeUndefined()
  })

  it('émet configure avec la nouvelle valeur quand elle reste valide', async () => {
    const wrapper = mountScreen({
      players: [...THREE_PLAYERS, player({ id: 'p4', displayName: 'Léa' }), player({ id: 'p5', displayName: 'Théo' })],
      undercoverCount: 1
    })
    const [, plus] = wrapper.findAllComponents(IconButton)
    await plus!.trigger('click')
    expect(wrapper.emitted('configure')).toEqual([[{ undercoverCount: 2 }]])
  })

  it('émet leave au clic sur quitter', async () => {
    const wrapper = mountScreen()
    const leave = wrapper.findAllComponents(Button).find(b => b.text().includes('Quitter'))!
    await leave.trigger('click')
    expect(wrapper.emitted('leave')).toHaveLength(1)
  })

  it('affiche une erreur serveur sans faire planter l’écran', () => {
    const wrapper = mountScreen({ error: 'La salle est complète.' })
    expect(wrapper.findComponent(Toast).exists()).toBe(true)
    expect(wrapper.text()).toContain('La salle est complète.')
  })

  it('copie le lien d’invitation sans lever d’exception si le presse-papiers est indisponible', async () => {
    const original = (navigator as unknown as { clipboard?: unknown }).clipboard
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })

    const wrapper = mountScreen()
    const copy = wrapper.findAllComponents(Button).find(b => b.text().includes('Copier'))!
    await expect(copy.trigger('click')).resolves.not.toThrow()

    Object.defineProperty(navigator, 'clipboard', { value: original, configurable: true })
  })

  it('copie effectivement le lien quand le presse-papiers est disponible', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

    const wrapper = mountScreen()
    const copy = wrapper.findAllComponents(Button).find(b => b.text().includes('Copier'))!
    await copy.trigger('click')
    await Promise.resolve()

    expect(writeText).toHaveBeenCalledWith('https://undercoverinfinite.com/salle/ABC234')
  })
})
