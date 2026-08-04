import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Avatar from './Avatar.vue'

describe('Avatar', () => {
  it('renders the initial and defaults to a 44px circle with no status dot', () => {
    const wrapper = mount(Avatar, { props: { initial: 'M' } })
    expect(wrapper.text()).toBe('M')
    expect(wrapper.attributes('style')).toContain('width: 44px')
    expect(wrapper.find('.rounded-full.absolute').exists()).toBe(false)
  })

  it('falls back to "?" when no initial is given', () => {
    const wrapper = mount(Avatar)
    expect(wrapper.text()).toBe('?')
  })

  it('scales the dot and font-size with a custom size', () => {
    const wrapper = mount(Avatar, { props: { initial: 'K', size: 56 } })
    expect(wrapper.attributes('style')).toContain('width: 56px')
    const dot = wrapper.find('span.absolute')
    expect(dot.exists()).toBe(false)
  })

  it('affiche la photo quand il y en a une', () => {
    const wrapper = mount(Avatar, { props: { initial: 'M', src: 'http://api.test/auth/avatar/u1?v=1' } })

    expect(wrapper.get('img').attributes('src')).toBe('http://api.test/auth/avatar/u1?v=1')
    expect(wrapper.text()).toBe('')
  })

  it('retombe sur l’initiale si la photo ne charge pas', async () => {
    // Photo effacée entre-temps, ou cache trop zélé : mieux vaut l'initiale
    // qu'un carré vide.
    const wrapper = mount(Avatar, { props: { initial: 'M', src: 'http://api.test/introuvable' } })

    await wrapper.get('img').trigger('error')

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toBe('M')
  })

  it('retente le chargement quand la photo change', async () => {
    const wrapper = mount(Avatar, { props: { initial: 'M', src: 'http://api.test/introuvable' } })
    await wrapper.get('img').trigger('error')

    await wrapper.setProps({ src: 'http://api.test/auth/avatar/u1?v=2' })

    expect(wrapper.find('img').exists()).toBe(true)
  })

  it.each([
    ['online', 'bg-success'],
    ['away', 'bg-amber-5'],
    ['eliminated', 'bg-danger']
  ] as const)('renders a %s status dot', (status, expectedClass) => {
    const wrapper = mount(Avatar, { props: { initial: 'M', status } })
    const dot = wrapper.find('span.absolute')
    expect(dot.exists()).toBe(true)
    expect(dot.classes()).toContain(expectedClass)
  })
})
