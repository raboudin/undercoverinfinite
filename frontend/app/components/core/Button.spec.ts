import { describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import Button from './Button.vue'

describe('Button', () => {
  it('renders slot content', () => {
    const wrapper = mount(Button, { slots: { default: 'Transmettre' } })
    expect(wrapper.text()).toBe('Transmettre')
  })

  it('defaults to primary variant and m size', () => {
    const wrapper = mount(Button)
    expect(wrapper.classes()).toContain('bg-accent-primary')
    expect(wrapper.classes()).toContain('text-sm')
  })

  it.each([
    ['primary', 'bg-accent-primary'],
    ['secondary', 'bg-accent-secondary'],
    ['ghost', 'border-default'],
    ['danger', 'border-danger']
  ] as const)('applies %s variant classes', (variant, expectedClass) => {
    const wrapper = mount(Button, { props: { variant } })
    expect(wrapper.classes()).toContain(expectedClass)
  })

  it.each([
    ['s', 'text-xs'],
    ['m', 'text-sm'],
    ['l', 'text-base']
  ] as const)('applies %s size classes', (size, expectedClass) => {
    const wrapper = mount(Button, { props: { size } })
    expect(wrapper.classes()).toContain(expectedClass)
  })

  it('disables the button and drops the pointer cursor', () => {
    const wrapper = mount(Button, { props: { disabled: true } })
    expect(wrapper.attributes('disabled')).toBeDefined()
    expect(wrapper.classes()).toContain('opacity-45')
    expect(wrapper.classes()).not.toContain('cursor-pointer')
  })

  it('fires click handlers passed by the parent', async () => {
    const onClick = vi.fn()
    const wrapper = mount(Button, { attrs: { onClick } })
    await wrapper.trigger('click')
    expect(onClick).toHaveBeenCalledOnce()
  })
})
