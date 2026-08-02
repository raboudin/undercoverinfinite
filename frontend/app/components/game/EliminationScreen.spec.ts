import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import EliminationScreen from './EliminationScreen.vue'
import Button from '../core/Button.vue'
import RoleTag from '../core/RoleTag.vue'
import Avatar from '../data-display/Avatar.vue'
import Card from '../data-display/Card.vue'
import type { Player } from '../../composables/useGame'

const global = { components: { Button, RoleTag, Avatar, Card } }

function mountScreen(overrides: Partial<Player> = {}) {
  const player: Player = {
    id: 'agent-1',
    name: 'Karim',
    role: 'civil',
    word: 'Passeport',
    alive: false,
    ...overrides
  }
  return mount(EliminationScreen, { props: { player }, global })
}

describe('EliminationScreen', () => {
  it('déclassifie le mot de l’agent grillé', () => {
    const wrapper = mountScreen()
    expect(wrapper.text()).toContain('Karim')
    expect(wrapper.text()).toContain('Passeport')
  })

  it('marque un undercover démasqué comme agent double', () => {
    const wrapper = mountScreen({ role: 'undercover', word: 'Visa' })
    const tag = wrapper.findComponent(RoleTag)
    expect(tag.text()).toBe('Agent double')
    expect(tag.props('tone')).toBe('danger')
    expect(wrapper.text()).toContain('neutraliser un infiltré')
  })

  it('signale l’erreur quand la cible était loyale', () => {
    const wrapper = mountScreen({ role: 'civil' })
    const tag = wrapper.findComponent(RoleTag)
    expect(tag.text()).toBe('Agent loyal')
    expect(tag.props('tone')).toBe('ally')
    expect(wrapper.text()).toContain('griller un des vôtres')
  })

  it('enchaîne sur le débriefing', async () => {
    const wrapper = mountScreen()
    await wrapper.findComponent(Button).trigger('click')
    expect(wrapper.emitted('next')).toHaveLength(1)
  })
})
