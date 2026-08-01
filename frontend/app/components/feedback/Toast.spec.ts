import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import Toast from './Toast.vue'

describe('Toast', () => {
  it('renders slot content and defaults to the info tone', () => {
    const wrapper = mount(Toast, { slots: { default: 'Agent connecté' } })
    expect(wrapper.text()).toBe('Agent connecté')
    expect(wrapper.classes()).toContain('border-blue-4')
    expect(wrapper.find('span').classes()).toContain('bg-blue-4')
  })

  it.each([
    ['danger', 'border-red-4', 'bg-red-4'],
    ['success', 'border-success', 'bg-success']
  ] as const)('applies %s tone classes to the border and dot', (tone, borderClass, dotClass) => {
    const wrapper = mount(Toast, { props: { tone } })
    expect(wrapper.classes()).toContain(borderClass)
    expect(wrapper.find('span').classes()).toContain(dotClass)
  })
})
