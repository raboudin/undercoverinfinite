import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import PlayerRow from './PlayerRow.vue'
import Avatar from './Avatar.vue'

// PlayerRow relies on Nuxt's auto-import of <Avatar>; register it explicitly
// for standalone component tests.
const global = { components: { Avatar } }

describe('PlayerRow', () => {
  it('renders the player name and defaults to active status', () => {
    const wrapper = mount(PlayerRow, { props: { name: 'Marion' }, global })
    expect(wrapper.text()).toContain('Marion')
    expect(wrapper.classes()).toContain('opacity-100')
    expect(wrapper.find('span.line-through').exists()).toBe(false)
  })

  it('dims and strikes through the name when eliminated', () => {
    const wrapper = mount(PlayerRow, { props: { name: 'Sami', status: 'eliminated' }, global })
    expect(wrapper.classes()).toContain('opacity-55')
    expect(wrapper.text()).toContain('Sami')
    expect(wrapper.find('span.line-through').exists()).toBe(true)
  })

  it('shows the host stamp only when isHost is set', () => {
    const withoutHost = mount(PlayerRow, { props: { name: 'Karim' }, global })
    expect(withoutHost.text()).not.toContain('hôte')

    const withHost = mount(PlayerRow, { props: { name: 'Marion', isHost: true }, global })
    expect(withHost.text()).toContain('hôte')
  })

  it('renders the action button only when actionLabel is given, and emits on click', async () => {
    const noAction = mount(PlayerRow, { props: { name: 'Karim' }, global })
    expect(noAction.find('button').exists()).toBe(false)

    const wrapper = mount(PlayerRow, {
      props: { name: 'Karim', actionLabel: 'ACCUSER' },
      global
    })
    const button = wrapper.find('button')
    expect(button.text()).toBe('ACCUSER')
    await button.trigger('click')
    expect(wrapper.emitted('action')).toHaveLength(1)
  })
})
