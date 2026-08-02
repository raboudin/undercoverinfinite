import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import RevealScreen from './RevealScreen.vue'
import Button from '../core/Button.vue'
import RoleTag from '../core/RoleTag.vue'
import Avatar from '../data-display/Avatar.vue'
import Card from '../data-display/Card.vue'
import type { Player } from '../../composables/useGame'

const global = { components: { Button, RoleTag, Avatar, Card } }

function player(overrides: Partial<Player> = {}): Player {
  return { id: 'agent-0', name: 'Marion', role: 'civil', word: 'Passeport', alive: true, ...overrides }
}

function mountScreen(props: Partial<InstanceType<typeof RevealScreen>['$props']> = {}) {
  return mount(RevealScreen, {
    props: { player: player(), index: 0, total: 4, isLast: false, ...props },
    global
  })
}

describe('RevealScreen', () => {
  it('garde le mot caché tant que le dossier n’est pas ouvert', () => {
    const wrapper = mountScreen()
    expect(wrapper.text()).toContain('Marion')
    expect(wrapper.text()).toContain('Dossier scellé')
    expect(wrapper.text()).not.toContain('Passeport')
  })

  it('affiche la position dans la distribution', () => {
    expect(mountScreen({ index: 2, total: 6 }).text()).toContain('3 / 6')
  })

  it('révèle le mot après un appui explicite', async () => {
    const wrapper = mountScreen()
    await wrapper.findComponent(Button).trigger('click')
    expect(wrapper.text()).toContain('Passeport')
    expect(wrapper.text()).toContain('Dossier ouvert')
  })

  it('referme le dossier avant de passer le téléphone', async () => {
    const wrapper = mountScreen()
    await wrapper.findComponent(Button).trigger('click')
    await wrapper.findComponent(Button).trigger('click')

    expect(wrapper.emitted('next')).toHaveLength(1)
    expect(wrapper.text()).not.toContain('Passeport')
  })

  it('referme aussi le dossier quand l’agent suivant prend le téléphone', async () => {
    const wrapper = mountScreen()
    await wrapper.findComponent(Button).trigger('click')
    expect(wrapper.text()).toContain('Passeport')

    await wrapper.setProps({
      player: player({ id: 'agent-1', name: 'Karim', role: 'undercover', word: 'Visa' }),
      index: 1
    })

    expect(wrapper.text()).not.toContain('Visa')
    expect(wrapper.text()).toContain('Dossier scellé')
  })

  it('change le libellé du bouton pour le dernier agent', async () => {
    const wrapper = mountScreen({ isLast: true })
    await wrapper.findComponent(Button).trigger('click')
    expect(wrapper.findComponent(Button).text()).toContain('Tout le monde est briefé')
  })

  it('ne dévoile jamais le rôle, seulement le mot', async () => {
    const wrapper = mountScreen({ player: player({ role: 'undercover', word: 'Visa' }) })
    await wrapper.findComponent(Button).trigger('click')
    expect(wrapper.text()).toContain('Visa')
    expect(wrapper.text().toLowerCase()).not.toContain('undercover')
  })
})
