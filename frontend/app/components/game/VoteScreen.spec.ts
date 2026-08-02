import { afterEach, describe, expect, it } from 'vitest'
import { DOMWrapper, mount } from '@vue/test-utils'
import VoteScreen from './VoteScreen.vue'
import Button from '../core/Button.vue'
import Avatar from '../data-display/Avatar.vue'
import Card from '../data-display/Card.vue'
import PlayerRow from '../data-display/PlayerRow.vue'
import Modal from '../feedback/Modal.vue'
import type { Player } from '../../composables/useGame'

const global = { components: { Button, Avatar, Card, PlayerRow, Modal } }

const candidates: Player[] = ['Marion', 'Karim', 'Sami'].map((name, i) => ({
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

function mountScreen() {
  return mount(VoteScreen, { props: { round: 2, candidates }, global })
}

/** Retrouve un bouton du modal téléporté hors de l'arbre du wrapper. */
function modalButton(label: string) {
  const match = [...document.body.querySelectorAll('button')].find(
    button => button.textContent?.trim() === label
  )
  return new DOMWrapper(match!)
}

describe('VoteScreen', () => {
  it('propose chaque agent encore en vie à l’accusation', () => {
    const rows = mountScreen().findAllComponents(PlayerRow)
    expect(rows).toHaveLength(3)
    expect(rows.map(row => row.props('name'))).toEqual(['Marion', 'Karim', 'Sami'])
    expect(rows[0]!.props('actionLabel')).toBe('ACCUSER')
  })

  it('rappelle la manche en cours', () => {
    expect(mountScreen().text()).toContain('Manche 2 — vote')
  })

  it('n’ouvre le modal de confirmation qu’après une accusation', async () => {
    const wrapper = mountScreen()
    expect(wrapper.findComponent(Modal).props('open')).toBe(false)

    await wrapper.findAllComponents(PlayerRow)[1]!.vm.$emit('action')
    expect(wrapper.findComponent(Modal).props('open')).toBe(true)
    expect(document.body.textContent).toContain('Désigner Karim comme agent double')
  })

  it('émet l’identifiant de la cible une fois l’accusation confirmée', async () => {
    const wrapper = mountScreen()
    await wrapper.findAllComponents(PlayerRow)[2]!.vm.$emit('action')
    await modalButton('Désigner cet agent').trigger('click')

    expect(wrapper.emitted('eliminate')).toEqual([['agent-2']])
    expect(wrapper.findComponent(Modal).props('open')).toBe(false)
  })

  it('n’élimine personne si l’accusation est annulée', async () => {
    const wrapper = mountScreen()
    await wrapper.findAllComponents(PlayerRow)[0]!.vm.$emit('action')
    await modalButton('Annuler').trigger('click')

    expect(wrapper.emitted('eliminate')).toBeUndefined()
    expect(wrapper.findComponent(Modal).props('open')).toBe(false)
  })
})
