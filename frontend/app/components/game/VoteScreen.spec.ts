import { afterEach, describe, expect, it } from 'vitest'
import { DOMWrapper, mount } from '@vue/test-utils'
import VoteScreen from './VoteScreen.vue'
import GameTable from './GameTable.vue'
import Button from '../core/Button.vue'
import Card from '../data-display/Card.vue'
import Modal from '../feedback/Modal.vue'
import type { Player } from '../../composables/useGame'

const global = { components: { Button, Card, Modal, GameTable } }

const PLAYERS: Player[] = ['Marion', 'Karim', 'Sami', 'Léa'].map((name, i) => ({
  id: `agent-${i}`,
  name,
  role: 'civil',
  word: 'Passeport',
  alive: true
}))

// Modal utilise Teleport(to="body") : sans nettoyage, les instances des tests
// précédents s'empilent dans document.body.
afterEach(() => {
  document.body.innerHTML = ''
})

function mountScreen(players: Player[] = PLAYERS) {
  return mount(VoteScreen, { props: { round: 2, players }, global })
}

/** Retrouve un bouton du modal téléporté hors de l'arbre du wrapper. */
function modalButton(label: string) {
  const match = [...document.body.querySelectorAll('button')].find(
    button => button.textContent?.trim() === label
  )
  return new DOMWrapper(match!)
}

function seats(wrapper: ReturnType<typeof mountScreen>) {
  return wrapper.findComponent(GameTable).findAll('button')
}

describe('VoteScreen', () => {
  it('rappelle la manche et le nombre de suspects', () => {
    expect(mountScreen().text()).toContain('Manche 2 — vote')
    expect(mountScreen().text()).toContain('4 suspects')
  })

  it('n’ouvre à l’accusation que les agents encore en poste', () => {
    const withDead = PLAYERS.map((player, i) => (i === 1 ? { ...player, alive: false } : player))
    const wrapper = mountScreen(withDead)

    expect(wrapper.text()).toContain('3 suspects')
    expect(seats(wrapper).map(seat => seat.attributes('disabled') === undefined))
      .toEqual([true, false, true, true])
  })

  it('laisse retournées les cartes déjà grillées', () => {
    const withDead = PLAYERS.map((player, i) =>
      i === 1 ? { ...player, alive: false, word: 'Visa' } : player
    )
    const wrapper = mountScreen(withDead)

    expect(wrapper.findAll('.flip-card--up')).toHaveLength(1)
    expect(wrapper.text()).toContain('Visa')
  })

  it('n’ouvre le modal de confirmation qu’après une accusation', async () => {
    const wrapper = mountScreen()
    expect(wrapper.findComponent(Modal).props('open')).toBe(false)

    await seats(wrapper)[1]!.trigger('click')

    expect(wrapper.findComponent(Modal).props('open')).toBe(true)
    expect(document.body.textContent).toContain('Désigner Karim comme agent double')
  })

  it('émet l’identifiant de la cible une fois l’accusation confirmée', async () => {
    const wrapper = mountScreen()
    await seats(wrapper)[2]!.trigger('click')

    await modalButton('Retourner sa carte').trigger('click')

    expect(wrapper.emitted('eliminate')).toEqual([['agent-2']])
    expect(wrapper.findComponent(Modal).props('open')).toBe(false)
  })

  it('n’élimine personne si l’accusation est annulée', async () => {
    const wrapper = mountScreen()
    await seats(wrapper)[0]!.trigger('click')

    await modalButton('Annuler').trigger('click')

    expect(wrapper.emitted('eliminate')).toBeUndefined()
    expect(wrapper.findComponent(Modal).props('open')).toBe(false)
  })

  it('ne laisse fuir aucun rôle ni aucun mot des vivants', () => {
    const wrapper = mountScreen(
      PLAYERS.map((player, i) => (i === 1 ? { ...player, role: 'undercover' as const, word: 'Visa' } : player))
    )
    expect(wrapper.text()).not.toContain('Visa')
    expect(wrapper.text()).not.toContain('Passeport')
    expect(wrapper.text().toLowerCase()).not.toContain('undercover')
  })
})
