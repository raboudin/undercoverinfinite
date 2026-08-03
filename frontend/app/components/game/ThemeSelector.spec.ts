import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ThemeSelector from './ThemeSelector.vue'
import Card from '../data-display/Card.vue'

const global = { components: { Card } }

const THEMES = [
  { id: 'general' as const, label: 'Tous horizons', generalist: true, unlocked: true },
  { id: 'culture' as const, label: 'Culture', generalist: true, unlocked: true },
  { id: 'football' as const, label: 'Football', generalist: false, unlocked: false }
]

function selector(modelValue = 'general') {
  return mount(ThemeSelector, { props: { themes: THEMES, modelValue }, global })
}

describe('ThemeSelector', () => {
  it('liste les thèmes du catalogue', () => {
    const wrapper = selector()
    expect(wrapper.findAll('button')).toHaveLength(3)
    expect(wrapper.text()).toContain('Football')
  })

  it('marque le thème courant', () => {
    const wrapper = selector()
    expect(wrapper.findAll('button')[0]!.attributes('aria-pressed')).toBe('true')
    expect(wrapper.findAll('button')[1]!.attributes('aria-pressed')).toBe('false')
  })

  it('sélectionne un thème ouvert', async () => {
    const wrapper = selector()

    await wrapper.findAll('button')[1]!.trigger('click')

    expect(wrapper.emitted('update:modelValue')).toEqual([['culture']])
  })

  it('renvoie un thème verrouillé vers la boutique sans le sélectionner', async () => {
    const wrapper = selector()

    await wrapper.findAll('button')[2]!.trigger('click')

    expect(wrapper.emitted('locked')).toEqual([['football']])
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })

  it('ne rend rien sans catalogue', () => {
    expect(mount(ThemeSelector, { global }).findAll('button')).toHaveLength(0)
  })
})
