import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import IconButton from './IconButton.vue'

describe('IconButton', () => {
  it('renders slot content and defaults to a 40px square', () => {
    const wrapper = mount(IconButton, { slots: { default: '<svg data-test="icon" />' } })
    expect(wrapper.find('[data-test="icon"]').exists()).toBe(true)
    expect(wrapper.attributes('style')).toContain('width: 40px')
    expect(wrapper.attributes('style')).toContain('height: 40px')
  })

  it('respects a custom size', () => {
    const wrapper = mount(IconButton, { props: { size: 24 } })
    expect(wrapper.attributes('style')).toContain('width: 24px')
    expect(wrapper.attributes('style')).toContain('height: 24px')
  })

  it('toggles the active styling', () => {
    const inactive = mount(IconButton)
    expect(inactive.classes()).toContain('bg-transparent')
    expect(inactive.classes()).toContain('border-subtle')

    const active = mount(IconButton, { props: { active: true } })
    expect(active.classes()).toContain('bg-ink-4')
    expect(active.classes()).toContain('border-strong')
  })
})
