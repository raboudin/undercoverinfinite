import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Card from './Card.vue'

describe('Card', () => {
  it('renders slot content with the default card shadow', () => {
    const wrapper = mount(Card, { slots: { default: '<p>Dossier</p>' } })
    expect(wrapper.html()).toContain('<p>Dossier</p>')
    expect(wrapper.classes()).toContain('shadow-card')
  })

  it.each([
    ['danger', 'shadow-glow-danger'],
    ['recon', 'shadow-glow-recon']
  ] as const)('swaps in the %s glow ring instead of the card shadow', (glow, expectedClass) => {
    const wrapper = mount(Card, { props: { glow } })
    expect(wrapper.classes()).toContain(expectedClass)
    expect(wrapper.classes()).not.toContain('shadow-card')
  })
})
